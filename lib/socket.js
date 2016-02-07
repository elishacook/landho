'use strict'

var uuid = require('uuid'),
    run_hooks = require('./hooks')


var SocketServer = function (api, wss, options)
{
    options = options || {}
    this.api = api
    this.serialize = options.serialize || JSON.stringify
    this.unserialize = options.unserialize || JSON.parse
    this.middleware = []
    this.clients = {}
    wss.on('connection', this.handle_connection.bind(this))
}


SocketServer.prototype.use = function (fn)
{
    this.middleware.push(fn)
    return this
}


SocketServer.prototype.handle_connection = function (socket)
{
    var client = {
        id: uuid.v4(),
        socket: socket,
        params: {},
        channels: {}
    }
    
    this.clients[client.id] = client
    
    run_hooks(this.middleware, [client], function (err)
    {
        if (err)
        {
            this.send_message(client, null, 'error', err)
        }
        else
        {
            socket.on('close', this.handle_close.bind(this, client))
            socket.on('message', this.handle_message.bind(this, client))
        }
    }.bind(this))
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
    
    if (message.name == 'channel')
    {
        this.handle_channel_message(client, message)
    }
    else
    {
        this.handle_service_message(client, message)
    }
}


SocketServer.prototype.handle_service_message = function (client, message)
{
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
    
    var params = message.data || {}
    
    Object.keys(client.params).forEach(function (k)
    {
        params[k] = client.params[k]
    })
    
    params.client_id = client.id
    params.socket = true
    
    method.call(service, params, function (err, result)
    {
        if (err)
        {
            if (err.stack)
            {
                console.error(err.stack)
                err = { code: 500, message: err.message }
            }
            this.send_message(client, message.id, 'error', err)
            return
        }
        else if (result.on && result.emit)
        {
            if (client.channels[result.id])
            {
                result.increment()
            }
            else
            {
                client.channels[result.id] = result
                result.on('*', this.send_channel_message.bind(this, client, result.id))
            }
            
            this.send_message(client, message.id, 'result', { channel: result.id })
        }
        else
        {
            this.send_message(client, message.id, 'result', { data: result })
        }
    }.bind(this))
}


SocketServer.prototype.handle_channel_message = function (client, message)
{
    var channel = client.channels[message.id]
    
    if (!channel)
    {
        this.send_message(client, message.id, 'error', { code: 404, message: 'No channel with this ID' })
    }
    else if (!message.data || !message.data.name)
    {
        this.send_message(client, message.id, 'error', { code: 400, message: 'Invalid channel message.' })
    }
    else if (message.data.name == 'close')
    {
        channel.decrement()
        
        if (channel.references == 0)
        {
            delete client.channels[message.id]
        }
    }
    else
    {
        channel.emit(message.data.name, message.data.data)
    }
}


SocketServer.prototype.send_channel_message = function (client, channel_id, name, data)
{
    this.send_message(client, channel_id, 'channel', { name: name, data: data })
}


SocketServer.prototype.handle_close = function (client)
{
    Object.keys(client.channels).forEach(function (k)
    {
        client.channels[k].emit('close')
    })
    
    client.channels = []
    delete this.clients[client.id]
}


SocketServer.prototype.send_message = function (client, message_id, name, data)
{
    try
    {
        client.socket.send(this.serialize(
        {
            id: message_id,
            name: name,
            data: data
        }))
    }
    catch (e)
    {
        if (e.message != 'not opened')
        {
            throw e
        }
    }
}


module.exports = function (api, wss, options)
{
    return new SocketServer(api, wss, options)
}