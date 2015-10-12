# Land Ho!!

A data service library for node.

[![Build Status][1]][2] [![NPM version][3]][4]

* [Install](#install)
* [Flavor](#flavor)
* [Guide](#guide)
   * [Basics](#basics)
   * [Channels](#channels)
   * [Before and after hooks](#hooks)
   * [WebSocket integration](#websocket-integration)
* [API Docs](#api-docs)

## What you get

* An API for creating services that support asynchronous communication
* Socket.IO integration
* [TODO] Express integration
* Hooks so you can validate, authorize or do whatever
* Frequent, wistful imaginings involving crow's nests and shouting

## Install

```bash
npm install --save landho
```

## Flavor

```js

// Create a landho instance
var landho = require('landho'),
    api = landho()

api
    // Setup the landho instance to use the web socket server
    .configure(landho.socket(wss))
    
    // Create a new service with a couple of methods
    .service('calc',
    {
        add: function (params, done)
        {
            // Use the regular node callback style
            done(null, params.a + params.b)
        },
        
        counter: function (params, done)
        {
            var channel = new landho.Channel(),
                interval = null,
                counter = 0
            
            channel.on('close', function ()
            {
                clearInterval(interval)
            })
            
            interval = setInterval(function ()
            {
                channel.emit('update', counter++)
            }, 500)
            
            done(null, channel)
        }
    })
    // add a hook before the add method that messes with the parameters
    .before(
    {
        add: function (params, next)
        {
            params.a = params.a * params.a
            
            // Don't foregt to call next(). You can pass it an error
            // if something bad happens.
            next()
        }
    })

// Lookup the service and call the counter() method
api.service('foo').counter({}, function (err, channel)
{
    channel.on('update', function (x)
    {
        if (x == 10)
        {
            channel.close()
        }
    })
})
```

## Guide

### Basics

To start, you create an API object and add services to it.

```js

// Create a landho instance.
var api = require('landho')()

// Define a service
api.service('calculator',
{
    add: function (params, done)
    {
        done(null, params.a + params.b)
    },
    
    subtract: function (params, done)
    {
        done(null, params.a - params.b)
    }
})

// Fetch the service and call one of its methods
api.service('calculator').add(
    { a: 5, b: 72 },
    function (err, result)
    {
        console.log(result) // 77
    }
)
```

As you can see, services are basically collections of methods written in standard node continuation style. There is more you can do, though.

### Channels

To create a service that provides asynchronous communication, return a channel object from a service method. Channels are bi-directional communication streams with the same interface as `EventEmitter`.

```js

// Fetch the service and extend 
// it with a new method.
api.service('counter',
{
    create: function (params, done)
    {
        var channel = new landho.Channel(),
            interval = null,
            counter = 0
        
        // This event will be emitted when the caller
        // calls channel.close()
        channel.on('close', function ()
        {
            clearInterval(interval)
        })
        
        // You can also subscribe to arbitrary events
        channel.on('foo', function (data)
        {
            console.log(data)
        })
        
        interval = setInterval(function ()
        {
            // Emit arbitrary events
            channel.emit('update', counter++)
        }, 500)
        
        // Send the channel to the caller
        done(null, channel)
    }
})

// The caller gets the other end of the channel.
api.service('counter').create(
    {},
    function (err, channel)
    {
        // Listen for events
        channel.on('update', function (counter)
        {
            console.log(counter) // 0...1...2..3...
        })
        
        // Send arbitrary events
        channel.emit('foo', 123)
        
        // And when we are done, close the channel
        setTimeout(function ()
        {
            channel.close()
        }, 1000)
    }
)
```

### Hooks

Hooks can be registered on a service method either before or after the method is called. Here is an example of using a `before` hook for validation.

```js
api.service('list').before(
{
    push: function (params, next)
    {
        if (params.value == undefined)
        {
            next(new Error('A value parameter must be provided'))
        }
        else
        {
            next()
        }
    }
})

// Now we have to provide a value when calling `list.push()` or it won't be run

api.service('list').push({}, function (err, result)
{
    console.log(err) // 'A value parameter must be provided'
})
```

Hooks are run in the order they are registered. If any hook fails by calling `next` with an error, processing stops and the method callback is called with the error object. If the caller provided a subscriber object, it has its `error()` method called.

`after` hooks are like `before` hooks but they run after the method successfully returns a result. They have access to the result of the method call in `params.result` and can transform it like so:

```js
api.service('list').after(
{
    get: function (params, next)
    {
        params.result = { list: params.result, other_thing: 123 }
        next()
    }
})

// Now when we call get(), we will get the transformed result
api.service('list').get({}, function (err, result)
{
    console.log(result) // { list: ['foo', 'bar', 'baz'], other_thing: 123 }
})
```

It's important to note that `after` hooks are never called for feed events.


### WebSocket integration

Landho can expose services over web sockets. You can write your own clients but there is also a [landho-client](https://github.com/elishacook/landho-client) that uses native web sockets.

Here is an example using [ws](https://github.com/websockets/ws).

```js
var landho = require('landho'),
    api = landho(),
    WebSocket = require('ws'),
    wss = new WebSocket.Server({ port:5000 })

api.configure(landho.socket(wss))
```

That's all that's needed. To call methods over a websocket, send a message including a service method name, data and a unique id. Below we show a raw WebSocket client.

```js
api.service('calc',
{
    add: function (params, done)
    {
        done(null, params.a + params.b)
    }
})

var client = new WebSocket('http://0.0.0.0:5000')

client.on('open', function ()
{
    client.on('message', function (raw)
    {
        var message = JSON.parse(raw)
        console.log(message)
        // {
        //     id: 'some-id',
        //     name: 'initial',
        //     data: 5
        // }
    })
    
    client.send(JSON.stringify(
    {
        id: 'some-id',
        name: 'calc add',
        data: { a: 2, b: 3 }
    }))
})
```

Channels are also supported. Here is what a client for the counter service from the [channels section](#channels) section looks like.


```js

api.service('counter', ...

var client = ...

client.on('open', function ()
{
    var channel_id = null
    
    client.on('message', function (raw)
    {
        var message = JSON.parse(raw)
        
        if (message.id == 'some-id')
        {
            assert(message.name == 'result')
            channel_id = message.data.channel
        }
        else if (message.id == channel_id)
        {
            assert(message.name == 'channel')
            assert(message.data.name == 'update')
            console.log(message.data.data) // 0...1...2...3...
            
            if (message.data.data == 10)
            {
                client.send(JSON.stringify(
                {
                    id: channel_id,
                    name: 'channel',
                    data:
                    {
                        name: 'close'
                    }
                }))
            }
        }
    })
    
    client.send(JSON.stringify(
    {
        id: 'some-id',
        name: 'calc add',
        data: { a: 2, b: 3 }
    }))
})
```

# API Docs

## landho

The landho package. 

```js
var landho = require('landho')
```

### Methods

#### landho() -> Application

Create a new landho application instance.

```js
var api = landho()
```

## Application

A landho application instance. Use it to create and fetch services and configure app-wide plugins. Create one using `landho()`

### Methods

#### Application.service(string:name, object:configuration) -> Service

Create a new service.

```js
var foo = api.service(
    'foo',
    {
        add: function (params, done)
        {
            done(null, params.a + params.b)
        }
    }
)
```

This method will throw an error if you try to register a service name that has already been registered.

```js
var foo = api.service('foo', {}),
    foo2 = api.service('foo', {}) -> Error('There is already a service registered with the name "foo"')
```

#### Application.service(string:name) -> Service || null

Fetch a service, if it exists.

```js
api.service(
    'foo',
    {
        add: function (params, done)
        {
            done(null, params.a + params.b)
        }
    }
)

var foo = api.service('foo')
foo.add({a:1, b:2})
```

It will return null if the service does not exist.

```js
var bar = api.service('bar')
console.log(bar) // -> null
```

## Service

A service is a named collection of methods and hooks.

### Methods

#### Service(string:name, object:configuration)

Create a new service.

You should not use this method to create services. To create a service use [`Application.service()`](#applicationservicestringname-objectconfiguration---service). That method takes the same arguments as this one but it will register the service on the application. This documentation is here mostly to explain the service configuration parameter.

Creating a service works like this:

```js
var api = landho()
api.service('foo', {
    add: function (params, done)
    {
        done(null, params.a + params.b)
    },
    multiply: function (params, done)
    {
        done(null, params.a * params.b)
    }
})
```

The keys of the configuration object are the names of the service methods and the values are their implementations. Service methods all have the same signature `method_name(<params>, <callback>)` and the callback uses the standard node form `callback(error, result)`.

#### Service.extend(object:configuration) -> Service

Add methods to an existing service. The `configuration` object is exactly like the one used when [creating a service](#servicestringname-objectconfiguration). Attempting to use a method name that has already been registered either during creation or a previous call to `extend()` will throw an error.

#### Service.before(object:hooks) -> Service

Add one or more hooks that will run before service methods. The `hooks` argument is an object where the keys are the names of service methods and the values are before hook implementations. A before hook has this signature:

##### hook(object:params, function:next) -> null

Hooks may modify the `params` object. When a hook is complete, it should call the `next()` function that was passed as the second argument. `next()` should be called with an error argument if the hook wants to stop execution of the service method, otherwise it should be called with no arguments. If `next()` is not called, execution will silently stop.

#### Service.after(object:hooks) -> Service

Add one or more hooks that will run after a service method completes successfully but before the caller receives the response. After hooks are run for request/response calls and before the callback of the `initial` method of a feed but not for the messages emitted to a subscriber of a feed.

After hooks are almost the same as before hooks. The main difference is when they run and the fact that the `params` object will have a `result` property. This is the result of the service method call and it can be manipulated by the after hook.

See the [hooks section](#hooks) of the guide for examples of before and after hooks.

[1]: https://secure.travis-ci.org/elishacook/landho.svg
[2]: https://travis-ci.org/elishacook/landho
[3]: https://badge.fury.io/js/landho.svg
[4]: https://badge.fury.io/js/landho