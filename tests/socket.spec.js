'use strict'

var PORT = 5151,
    URL = 'http://0.0.0.0:'+PORT,
    OPTIONS = {
        transports: ['websocket'],
        'force new connection': true
    },
    io = require('socket.io').listen(PORT),
    io_client = require('socket.io-client'),
    landho = require('../lib'),
    api = landho()
    
api
    .configure(landho.socket(io))
    .service('calc',
    {
        wrong: function (params, done)
        {
            done({ message: 'wrong' })
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
        var client = io_client.connect(URL, OPTIONS)
        client.on('connect', function ()
        {
            client.emit('calc add', { a: 3, b: 2 }, function (err, feed_id)
            {
                client.on(feed_id+' initial', function (result)
                {
                    expect(result).to.equal(5)
                    client.disconnect()
                    done()
                })
            })
        })
    })
    
    it('can call a feed method', function (done)
    {
        var client = io_client.connect(URL, OPTIONS)
        client.on('connect', function ()
        {
            client.emit('calc counter', {}, function (err, feed_id)
            {
                expect(err).to.be.null
                
                var calls = 0
                
                client.on(feed_id + ' initial', function (c)
                {
                    expect(c).to.equal(0)
                    calls++
                })
                
                client.on(feed_id + ' update', function (c)
                {
                    expect(calls).to.be.gt(0)
                    expect(c).to.equal(calls)
                    calls++
                    
                    if (calls > 3)
                    {
                        client.disconnect()
                        done()
                    }
                })
            })
        })
    })
    
    it('can close a feed from the client', function (done)
    {
        var client = io_client.connect(URL, OPTIONS)
        client.on('connect', function ()
        {
            client.emit('calc counter', {}, function (err, feed_id)
            {
                expect(err).to.be.null
                
                var calls = 0
                
                client.on(feed_id + ' initial', function (c)
                {
                    expect(c).to.equal(0)
                    calls++
                })
                
                client.on(feed_id + ' update', function (c)
                {
                    expect(calls).to.be.gt(0)
                    expect(c).to.equal(calls)
                    calls++
                    
                    if (calls == 2)
                    {
                        // We have to leave some time for 
                        // update events in the pipe to arrive
                        // before we check to see if the feed
                        // has stopped
                        client.emit(feed_id + ' close')
                        setTimeout(function ()
                        {
                            var orig_calls = calls
                            setTimeout(function ()
                            {
                                expect(calls).to.equal(orig_calls)
                                client.disconnect()
                                done()
                            }, 50)
                        }, 50)
                    }
                })
            })
        })
    })
    
    it('calls the callback with the error if there is an inital error', function (done)
    {
        var client = io_client.connect(URL, OPTIONS)
        client.on('connect', function ()
        {
            client.emit('calc wrong', {}, function (err)
            {
                expect(err).to.not.be.undefined
                expect(err.message).to.equal('wrong')
                done()
            })
        })
    })
})