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
    api = landho()
    
api
    .configure(landho.socket(wss))
    .service('calc',
    {
        wrong: function (params, done)
        {
            done({ code: 123, message: 'wrong' })
        },
        
        add: function (params, done)
        {
            done(null, params.a + params.b)
        },
        
        counter: function (params)
        {
            var counter = 0
                
            return {
                initial: function (done)
                {
                    done(null, counter)
                },
                changes: function (subscriber, done)
                {
                    var interval = setInterval(function ()
                    {
                        subscriber.emit('update', ++counter)
                    }, 1)
                    
                    done(null, { close: clearInterval.bind(null, interval) })
                }
            }
        }
    })

describe('socket', function ()
{
    it('can call a request/response method', function (done)
    {
        var client = new WebSocket(URL)
        client.on('open', function ()
        {
            var message_id = 'first-test-call'
            
            client.on('message', function (raw_message)
            {
                var message = JSON.parse(raw_message)
                expect(message.id).to.equal(message_id)
                expect(message.name).to.equal('initial')
                expect(message.data).to.equal(5)
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
    
    it('can call a feed method', function (done)
    {
        var client = new WebSocket(URL)
        client.on('open', function ()
        {
            var message_id = 'second-test-call',
                calls = 0
            
            client.on('message', function (raw_message)
            {
                calls++
                
                var message = JSON.parse(raw_message)
                
                expect(message.id).to.equal(message_id)
                
                if (message.name == 'initial')
                {
                    expect(message.data).to.equal(0)
                }
                else if (message.name == 'update')
                {
                    expect(calls).to.be.gt(0)
                    expect(message.data).to.equal(calls - 1)
                    
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
    
    it('can close a feed from the client', function (done)
    {
        var client = new WebSocket(URL)
        client.on('open', function ()
        {
            var message_id = 'second-test-call',
                calls = 0
            
            client.on('message', function (raw_message)
            {
                calls++
                
                var message = JSON.parse(raw_message)
                
                expect(message.id).to.equal(message_id)
                
                if (message.name == 'initial')
                {
                    expect(message.data).to.equal(0)
                }
                else if (message.name == 'update')
                {
                    expect(calls).to.be.gt(0)
                    expect(message.data).to.equal(calls - 1)
                    
                    if (calls == 3)
                    {
                        // We have to leave some time for 
                        // update events in the pipe to arrive
                        // before we check to see if the feed
                        // has stopped
                        client.send(JSON.stringify(
                        {
                            id: message_id,
                            name: 'close'
                        }))
                        
                        setTimeout(function ()
                        {
                            var orig_calls = calls
                            setTimeout(function ()
                            {
                                expect(calls).to.equal(orig_calls)
                                client.close()
                                done()
                            }, 10)
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
    
    it('sends error messages', function (done)
    {
        var client = new WebSocket(URL)
        client.on('open', function ()
        {
            var message_id = 'third-test-call',
                calls = 0
            
            client.on('message', function (raw_message)
            {
                var message = JSON.parse(raw_message)
                expect(message.id).to.equal(message_id)
                expect(message.name).to.equal('error')
                expect(message.data).to.deep.equal({ code: 123, message: 'wrong' })
                done()
            })
            
            client.send(JSON.stringify(
            {
                id: message_id,
                name: 'calc wrong',
                data: {}
            }))
            
            client.emit('calc wrong', {}, function (err)
            {
                expect(err).to.not.be.undefined
                expect(err.message).to.equal('wrong')
                done()
            })
        })
    })
})