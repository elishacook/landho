'use strict'

var io_wildcard = require('socketio-wildcard')()

module.exports = function (io)
{
    io.use(io_wildcard)
    
    return function (api)
    {
        io.on('connection', function (socket)
        {
            socket.on('*', function (event)
            {
                var name = event.data[0],
                    params = event.data[1],
                    callback = event.data[2]
                    
                var path = name.split(' ')
                
                if (path.length < 2)
                {
                    return
                }
                
                var service = api.service(path[0])
                
                if (!service)
                {
                    return
                }
                
                var method = service[path[1]]
                
                if (!method)
                {
                    return
                }
                
                var feed_id = socket.id + ' ' + path.join(' ') + ' ' + (new Date().getTime())
                
                params.user = socket.request.user
                params.subscriber = {
                    emit: function ()
                    {
                        var args = Array.prototype.slice.apply(arguments)
                        args[0] = feed_id + ' ' + args[0]
                        socket.emit.apply(socket, args)
                    }
                }
                
                method.call(service, params, function (err, feed)
                {
                    if (err)
                    {
                        callback(err)
                        return
                    }
                    
                    if (feed)
                    {
                        var close = feed.close.bind(feed)
                        socket.on('disconnect', close)
                        socket.on(feed_id + ' close', close)
                    }
                    
                    callback(null, feed_id)
                })
            })
        })
    }
}