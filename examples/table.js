var r = require('rethinkdbdash')({ db: 'test' }),
	Table = require('../lib/Table'),
	pink = new Table(r, 'pink'),
	patcher = require('jsondiffpatch')

pink.watch_filter().then(function (feed)
{
	feed.subscribe(function (error, delta)
	{
		console.log('DELTA:', delta)
	})
})

var id = 'e03ce187-4a3e-49f5-bf85-0b2d29b8fd1e'

pink.get(id).then(function (record)
{
	var new_record = {}
	Object.keys(record).forEach(function (k)
	{
		new_record[k] = record[k]
	})
	new_record.randval = Math.random()
	
	var diff = patcher.diff(record, new_record)
	pink.patch(id, diff).then(function (result)
	{
		console.log('PATCH:', result)
	})
})