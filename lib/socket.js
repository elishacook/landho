'use strict'

var uuid = require('uuid')


var SocketServer = function (api, wss, options)
{
    options = options || {}
    this.api = api
    this.serialize = options.serialize || JSON.stringify,
    this.unserialize = options.unserialize || JSON.parse,
    this.authorize = options.authorize
    
    wss.on('connection', this.handle_connection.bind(this))
}

SocketServer.prototype.handle_connection = function (socket)
{
    var client = {
        id: uuid.v4(),
        socket: socket,
        feeds: {}
    }
    
    var setup_socket = function ()
    {
        socket.on('close', this.handle_close.bind(this, client))
        socket.on('message', this.handle_message.bind(this, client))
    }.bind(this)
    
    if (this.authorize)
    {
        this.authorize(socket, function (err, user)
        {
            if (err)
            {
                this.send_message(client, null, 'error', err)
            }
            else
            {
                client.user = user
                setup_socket(socket)
            }
        }.bind(this))
    }
    else
    {
        setup_socket(socket)
    }
}

SocketServer.prototype.handle_close = function (client)
{
    Object.keys(client.feeds).forEach(function (k)
    {
        client.feeds[k].close()
    })
    
    client.feeds = []
    client.feed_counter = 0
}

SocketServer.prototype.close_feed = function (client, feed_id)
{
    var feed = client.feeds[feed_id]
    if (feed)
    {
        feed.close()
    }
    delete client.feeds[feed_id]
}

SocketServer.prototype.send_message = function (client, message_id, name, data)
{
    client.socket.send(this.serialize(
    {
        id: message_id,
        name: name,
        data: data
    }))
}

SocketServer.prototype.handle_message = function (client, raw_message)
{
    var message
    
    try
    {
        message = this.unserialize(raw_message)
    }
    catch (err)
    {
        this.send_message(client, null, 'error', { code: 400, message: 'Could not parse message data' })
        return
    }
    
    if (!message.name || !message.id)
    {
        this.send_message(client, null, 'error', { code: 400, message: 'Invalid message. A name and ID are required.' })
        return
    }
    
    if (message.name == 'close')
    {
        this.close_feed(client, message.id)
        return
    }
    
    var path = message.name.split(' ')
    
    if (path.length < 2)
    {
        this.send_message(client, message.id, 'error', { code: 400, message: 'Invalid name. Correct format is "<service> <method>"' })
        return
    }
    
    var service = this.api.service(path[0])
    
    if (!service)
    {
        this.send_message(client, message.id, 'error', { code: 400, message: 'Unknown service "'+path[0]+'"' })
        return
    }
    
    var method = service[path[1]]
    
    if (!method)
    {
        this.send_message(client, message.id, 'error', { code: 400, message: 'Unknown method "'+path[0]+' '+path[1]+'"' })
        return
    }
    
    var params = message.data
    params.user = this.user
    params.subscriber = {
        emit: this.send_message.bind(this, client, message.id)
    }
    
    method.call(service, params, function (err, feed)
    {
        if (err)
        {
            this.send_message(client, message.id, 'error', err)
            return
        }
        
        if (feed)
        {
            client.feeds[message.id] = feed
        }
    }.bind(this))
}

module.exports = function (wss, options)
{
    return function (api)
    {
        return new SocketServer(api, wss, options)
    }
}