"use strict"

var patcher = require('jsondiffpatch')

var delta_from_rchange = function (change)
{
	if (!change.old_val)
	{
		var record = change.new_val
		return {
			op: '+',
			record: record.id,
			version: record.version,
			time: record.created,
			data: record
		}
	}
	else if (!change.new_val)
	{
		var record = change.old_val
		return {
			op: '-',
			record: record.id,
			version: record.version + 1,
			time: new Date(),
			data: record
		}
	}
	else
	{
		var old_record = change.old_val,
			new_record = change.new_val,
			patch = patcher.diff(old_record, new_record)
			
		return {
			op: '~',
			record: new_record.id,
			version: new_record.version,
			time: new_record.modified
		}
	}
}

var watcher = function ()
{
	return function (cursor)
	{
		return {
			subscribe: function (fn)
			{
				cursor.each(function (err, change)
				{
					if (err)
					{
						fn(err)
					}
					else
					{
						fn(null, delta_from_rchange(change))
					}
				})
			},
			unsubscribe: function ()
			{
				cursor.close()
			}
		}
	}
}

var Table = function (r, name)
{
	this.r = r
	this.name = name
	this.log_name = name + '_changes'
	this.max_patch_attempts = 10
}


Table.prototype.get = function (id)
{
	return this.r.table(this.name).get(id).run()
}

Table.prototype.watch = function (id)
{
	return this.r.table(this.log_name)
				.get(id)
				.changes()
				.run()
				.then(watcher())
}

Table.prototype.create = function (record)
{
	record.version = 0
	record.created = record.modified = this.r.now()
	return this.r.table(this.name).insert(record, { returnChanges: true }).then(function (result)
	{
		var delta = delta_from_rchange(result.changes[0])
		this.r.table(this.log_name).insert(delta)
		return delta
	}.bind(this))
}

Table.prototype.patch = function (id, patch, attempts)
{
	if (!attempts)
	{
		attempts = 0
	}
	
	return this.r.table(this.name).get(id).then(function (record)
	{
		if (!record)
		{
			throw new Error('No record found with an ID of '+id)
		}
		else if (attempts > this.max_patch_attempts)
		{
			return { op: 0 }
		}
		else
		{
			var old_version = record.version
			patcher.patch(record, patch)
			record.modified = this.r.now()
			record.version = record.version + 1
			return this.r.table(this.name)
						.filter(
						{
							id: record.id,
							version: old_version
						})
						.replace(record, { returnChanges: true })
						.then(function (result)
						{
							if (result.replaced == 0)
							{
								return this.patch(id, patch, attempts + 1)
							}
							else
							{
								var delta = delta_from_rchange(result.changes[0])
								this.r.table(this.log_name).insert(delta)
								return delta
							}
						}.bind(this))
		}
	}.bind(this))
}

Table.prototype.delete = function (id)
{
	return this.r.table(this.table).get(id).delete({ returnChanges: true }).then(function (result)
	{
		var delta = delta_from_rchange(result.changes[0])
		delta.time = this.r.now()
		this.r.table(this.log_name).insert(delta)
		return delta
	})
}

Table.prototype.filter = function (query)
{
	query = query || {}
	return this.r.table(this.name).filter(query).run()
}

Table.prototype.watch_filter = function (query)
{
	query = query || {}
	return this.r.table(this.name).filter(query).changes().run().then(watcher())
}

module.exports = Table