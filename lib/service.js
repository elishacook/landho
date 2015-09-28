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
                    if (!done)
                    {
                        throw new Error('No callback provided')
                    }
                    
                    run_hooks(this.hooks.before[k], params, function (err)
                    {
                        if (err)
                        {
                            done(err)
                        }
                        else
                        {
                            var reponse_callback = run_with_after_hooks(this.hooks.after[k], params, done),
                                feed = method.call(this, params, reponse_callback)
                            
                            if (feed)
                            {
                                if (params.subscriber)
                                {
                                    var subscriber = params.subscriber
                                    
                                    feed.initial(function (err, result)
                                    {
                                        if (err)
                                        {
                                            done(err)
                                        }
                                        else
                                        {
                                            feed.changes(subscriber, function (err, feed)
                                            {
                                                if (err)
                                                {
                                                    done(err)
                                                }
                                                else
                                                {
                                                    done(null, feed)
                                                    subscriber.emit('initial', result)
                                                }
                                            })
                                        }
                                    })
                                }
                                else
                                {
                                    feed.initial(reponse_callback)
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

function run_with_after_hooks (hooks, params, done)
{
    return function (err, result)
    {
        if (err)
        {
            done(err)
        }
        else
        {
            params.result = result
            run_hooks(hooks, params, function (err)
            {
                if (err)
                {
                    done(err)
                }
                else if (params.subscriber)
                {
                    done(null, null)
                    params.subscriber.emit('initial', params.result)
                }
                else
                {
                    done(null, params.result)
                }
            })
        }
    }.bind(this)
}

module.exports = Service