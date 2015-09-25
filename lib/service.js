'use strict'

var Service = function (name, methods)
{
    this.name = name
    this.hooks = { before: {}, after: {} }
    if (methods)
    {
        this.extend(methods)
    }
}

Service.prototype.extend = function (methods)
{
    Object.keys(methods).forEach(function (k)
    {
        if (this[k])
        {
            throw new Error('There is already a "'+this.name+'" method called "'+k+'"')
        }
        else
        {
            var method = methods[k]
            
            Object.defineProperty(this, k, 
            {
                enumerable: true,
                value: function (params, done)
                {
                    run_hooks(this.hooks.before[k], params, function (err)
                    {
                        if (err)
                        {
                            done(err)
                        }
                        else
                        {
                            var handle_value = function (err, result)
                            {
                                if (err)
                                {
                                    done(err)
                                }
                                else
                                {
                                    params.result = result
                                    run_hooks(this.hooks.after[k], params, function (err)
                                    {
                                        if (err)
                                        {
                                            done(err)
                                        }
                                        else
                                        {
                                            done(null, params.result)
                                        }
                                    })
                                }
                            }.bind(this)
                            
                            var result = method.call(this, params, handle_value)
                            
                            if (result)
                            {
                                if (params.subscriber)
                                {
                                    result.feed(params.subscriber, done)
                                }
                                else
                                {
                                    result.value(handle_value)
                                }
                            }
                        }
                    }.bind(this))
                    
                    return this
                }
            })
        }
    }.bind(this))
    
    return this
}

Service.prototype.before = function (hooks)
{
    add_hooks(this.hooks.before, hooks, this)
    return this
}

Service.prototype.after = function (hooks)
{
    add_hooks(this.hooks.after, hooks, this)
    return this
}

function add_hooks (hooks, new_hooks, method_map)
{
    Object.keys(new_hooks).forEach(function (k)
    {
        if (!method_map[k])
        {
            throw new Error('Attempting to hook unregistered method "'+k+'"')
        }
        
        if (hooks[k])
        {
            hooks[k].push(new_hooks[k])
        }
        else
        {
            hooks[k] = [ new_hooks[k] ]
        }
    })
}

function run_hooks (hooks, params, done)
{
    if (!hooks)
    {
        done()
    }
    else
    {
        run_next_hook(hooks, 0, params, done)
    }
}

function run_next_hook (hooks, i, params, done)
{
    if (i >= hooks.length)
    {
        done()
        return
    }
    
    var hook = hooks[i]
    
    hook(params, function (err)
    {
        if (err)
        {
            done(err)
        }
        else
        {
            run_next_hook(hooks, i+1, params, done)
        }
    })
}

module.exports = Service