'use strict'

module.exports = function (wss, options)
{
    options = options || {}
    var serialize = options.serialize || JSON.stringify,
        unserialize = options.unserialize || JSON.parse,
        authorize = options.authorize
    
    var send_message = function (socket, id, name, data)
    {
        var msg = 
        {
            name: name,
            data: data
        }
        
        if (id)
        {
            msg.id = id
        }
        
        socket.send(serialize(msg))
    }
    
    var feeds = {}
    var close_feed = function (id)
    {
        var feed = feeds[id]
        if (feed)
        {
            feed.close()
        }
    }
    
    return function (api)
    {
        var setup = function (socket, user)
        {
            socket.on('message', function (raw_message)
            {
                var message
                try
                {
                    message = unserialize(raw_message)
                }
                catch (err)
                {
                    send_message(socket, null, 'error', { code: 400, message: 'Could not parse message data' })
                    return
                }
                
                if (!message.name || !message.id)
                {
                    send_message(socket, null, 'error', { code: 400, message: 'Invalid message. A name and ID are required.' })
                    return
                }
                
                if (message.name == 'close')
                {
                    close_feed(message.id)
                    return
                }
                
                var path = message.name.split(' ')
                
                if (path.length < 2)
                {
                    send_message(socket, message.id, 'error', { code: 400, message: 'Invalid name. Correct format is "<service> <method>"' })
                    return
                }
                
                var service = api.service(path[0])
                
                if (!service)
                {
                    send_message(socket, message.id, 'error', { code: 400, message: 'Unknown service "'+path[0]+'"' })
                    return
                }
                
                var method = service[path[1]]
                
                if (!method)
                {
                    send_message(socket, message.id, 'error', { code: 400, message: 'Unknown method "'+path[0]+' '+path[1]+'"' })
                    return
                }
                
                var params = message.data
                params.user = user
                params.subscriber = {
                    emit: function (name, data)
                    {
                        send_message(socket, message.id, name, data)
                    }
                }
                
                method.call(service, params, function (err, feed)
                {
                    if (err)
                    {
                        send_message(socket, message.id, 'error', err)
                        return
                    }
                    
                    if (feed)
                    {
                        feeds[message.id] = feed
                        socket.on('close', close_feed.bind(null, message.id))
                    }
                })
            })
        }
        
        wss.on('connection', function (socket)
        {
            if (authorize)
            {
                authorize(socket, function (err, user)
                {
                    if (err)
                    {
                        send_error(socket, err)
                    }
                    else
                    {
                        setup(socket, user)
                    }
                })
            }
            else
            {
                setup(socket)
            }
        })
    }
}