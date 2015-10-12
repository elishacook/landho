'use strict'

var PORT = 5151,
    URL = 'http://0.0.0.0:'+PORT,
    OPTIONS = {
        transports: ['websocket'],
        'force new connection': true
    },
    WebSocket = require('ws'),
    wss = new WebSocket.Server({ port: PORT }),
    landho = require('../lib'),
    api = landho(),
    api_server = landho.socket(api, wss),
    Channel = require('../lib/channel').Channel

api_server.use(function (client, next)
{
    client.params.foo = 23
    next()
})

api.service('calc',
{
    check_middleware: function (params, done)
    {
        done(null, params.foo)
    },
    
    wrong: function (params, done)
    {
        done({ code: 123, message: 'wrong' })
    },
    
    add: function (params, done)
    {
        done(null, params.a + params.b)
    },
    
    counter: function (params, done)
    {
        var channel = new Channel(),
            interval = null,
            counter = 0
        
        channel.on('close', function ()
        {
            clearInterval(interval)
        })
        
        interval = setInterval(function ()
        {
            channel.emit('update', ++counter)
        }, 1)
        
        done(null, channel)
    }
})

describe('socket', function ()
{
    it('can call a method', function (done)
    {
        var client = new WebSocket(URL)
        client.on('open', function ()
        {
            var message_id = 'msg-id'
            
            client.on('message', function (raw_message)
            {
                var message = JSON.parse(raw_message)
                expect(message.id).to.equal(message_id)
                expect(message.name).to.equal('result')
                expect(message.data).to.deep.equal({ data: 5 })
                client.close()
                done()
            })
            
            client.send(JSON.stringify(
            {
                id: message_id,
                name: 'calc add',
                data: { a: 3, b: 2 }
            }))
        })
    })
    
    it('can interact with a channel response', function (done)
    {
        var client = new WebSocket(URL)
        client.on('open', function ()
        {
            var message_id = 'msg-id',
                channel_id = null,
                calls = 0
            
            client.on('message', function (raw_message)
            {
                calls++
                
                var message = JSON.parse(raw_message)
                
                if (message.id == message_id)
                {
                    expect(message.name).to.equal('result')
                    expect(message.data).to.have.property('channel')
                    channel_id = message.data.channel
                }
                else
                {
                    expect(message.name).to.equal('channel')
                    expect(calls).to.be.gt(0)
                    expect(message.data).to.deep.equal({
                        name: 'update',
                        data: calls - 1
                    })
                    
                    if (calls == 4)
                    {
                        client.close()
                        done()
                    }
                }
            })
            
            client.send(JSON.stringify(
            {
                id: message_id,
                name: 'calc counter',
                data: {}
            }))
        })
    })
    
    it('can close a channel from the client', function (done)
    {
        var client = new WebSocket(URL)
        client.on('open', function ()
        {
            var message_id = 'msg-id',
                channel_id = null,
                calls = 0
            
            client.on('message', function (raw_message)
            {
                calls++
                
                var message = JSON.parse(raw_message)
                
                if (message.id == message_id)
                {
                    expect(message.name).to.equal('result')
                    expect(message.data).to.have.property('channel')
                    channel_id = message.data.channel
                }
                else
                {
                    expect(message.name).to.equal('channel')
                    expect(calls).to.be.gt(0)
                    expect(message.data).to.deep.equal({
                        name: 'update',
                        data: calls - 1
                    })
                    
                    if (calls == 3)
                    {
                        // We have to leave some time for 
                        // update events in the pipe to arrive
                        // before we check to see if the feed
                        // has stopped
                        client.send(JSON.stringify(
                        {
                            id: channel_id,
                            name: 'channel',
                            data: {
                                name: 'close'
                            }
                        }))
                        
                        setTimeout(function ()
                        {
                            var keys = Object.keys(api_server.clients)
                            expect(keys.length).to.equal(1)
                            var client = api_server.clients[keys[0]]
                            expect(client.channels).to.deep.equal({})
                            done()
                        }, 10)
                    }
                }
            })
            
            client.send(JSON.stringify(
            {
                id: message_id,
                name: 'calc counter',
                data: {}
            }))
        })
    })
    
    it('can have middleware that modifies all request parameters', function (done)
    {
        var client = new WebSocket(URL)
        client.on('open', function ()
        {
            var message_id = 'msg-id'
            
            client.on('message', function (raw_message)
            {
                var message = JSON.parse(raw_message)
                expect(message.id).to.equal(message_id)
                expect(message.name).to.equal('result')
                expect(message.data).to.deep.equal({ data: 23 })
                done()
            })
            
            client.send(JSON.stringify(
            {
                id: message_id,
                name: 'calc check_middleware'
            }))
        })
    })
})