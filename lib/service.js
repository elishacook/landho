'use strict'

var run_hooks = require('./hooks')

module.exports = Service

function Service (name, methods)
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
                    params = params || {}
                    var run = function (done)
                    {
                        run_hooks(this.hooks.before[k], [params], function (err)
                        {
                            if (err)
                            {
                                done(err)
                            }
                            else
                            {
                                var finish = function (err, result)
                                {
                                    if (err)
                                    {
                                        done(err)
                                    }
                                    else
                                    {
                                        if (result && result.on && result.emit && result.end)
                                        {
                                            params.result = result.end
                                        }
                                        else
                                        {
                                            params.result = result
                                        }
                                        
                                        run_hooks(this.hooks.after[k], [params], function (err)
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
                                
                                var result = method.call(
                                    this, 
                                    params,
                                    finish
                                )
                                
                                if (result && result.then && result.catch)
                                {
                                    result
                                        .then((res) => finish(null, res))
                                        .catch(finish)
                                }
                            }
                        }.bind(this))
                    }.bind(this)

                    if (done)
                    {
                        return run(done)
                    }
                    else
                    {
                        return new Promise(function (resolve, reject)
                        {
                            run(function (err, result)
                            {
                                if (err)
                                {
                                    reject(err)
                                }
                                else
                                {
                                    resolve(result)
                                }
                            })
                        })
                    }
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
        
        if (!hooks[k])
        {
            hooks[k] = []
        }
        
        if (new_hooks[k].constructor == Array)
        {
            new_hooks[k].forEach(function (h)
            {
                hooks[k].push(h)
            })
        }
        else
        {
            hooks[k].push(new_hooks[k])
        }
    })
}