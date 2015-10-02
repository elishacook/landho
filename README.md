# Land Ho!!

A data service library for node.

[![Build Status][1]][2] [![NPM version][3]][4]

* [Install](#install)
* [Flavor](#flavor)
* [Guide](#guide)
   * [Basics](#basics)
   * [Creating realtime feeds](#creating-realtime-feeds)
   * [Feed calling styles](#feed-calling-styles)
   * [Before and after hooks](#hooks)
   * [WebSocket integration](#websocket-integration)
* [API Docs](#api-docs)

## What you get

* One API for creating services with both request/response and realtime feed models
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
    
    // Create a new service with a single method called 'counter'
    .service('foo',
    {
        counter: function (params)
        {
            // Return a feed object that updates a counter and pushes
            // the changes to a subscriber
            return {
                initial: function (done) { done(null, params.start) },
                changes: function (subscriber, done)
                {
                    var c = params.start,
                        interval = setInterval(function ()
                        {
                            subscriber.emit('update', ++c)
                        }, 500)
                        
                    done(null, { close: clearInterval.bind(null, interval) })
                }
            }
        }
    })
    // add a hook before the counter method that messes with the parameters
    .before(
    {
        counter: function (params, next)
        {
            if (!params.start)
            {
                params.start = 0
            }
            
            params.start = params.start * params.start
        }
    })

// Lookup the serive and call the counter() method
api.service('foo').counter({
    start: 10,
    subscriber: {
        emit: function (event_name, value)
        {
            console.log(event_name, value) // 'initial' 100...'update' 101...'update' 102
        }
    }
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

As you can see, services are basically collections of methods written in standard node continuation style. This is how you create services with a request/response model. There's lots more you can do.

### Creating realtime feeds

To create a service that provides a realtime feed, write your method to return a feed object.

```js

// Fetch the service and extend 
// it with a new method.
api.service('counter',
{
    // Notice that we ignore the `done` callback. 
    // It doesn't get used when we return a feed object.
    create: function (params)
    {
        // Feed objects have two methods. inital() sets the initial value
        // and changes() notifies subscribers about changes.
        return {
            initial: function (done)
            {
                done(null, 0)
            },
            changes: function (subscriber, done)
            {
                var counter = 0
                var interval = setInterval(function ()
                {
                    counter += 1
                    
                    // Updates the subscriber each time the count
                    // is incremented
                    subscriber.emit('update', counter)
                }, 1000)
                
                // Call the callback with an object that has a `close()`
                // method that will ensure the subscriber is no longer updated.
                done(null, { 
                    close: function () {
                        clearInterval(interval)
                    }
                })
            }
        }
    }
})

// We can subscribe to the feed by passing a subscriber 
// object in the the params.
api.service('counter').create(
    {
        subscriber: {
            // Gets called on each increment
            emit: function (event, value)
            {
                console.log(event, value) // 'initial' 0...'update' 1...'update' 2...
            }
        }
    },
    function (err, feed)
    {
        // And when we are done, we'll want to close the feed
        setTimeout(function ()
        {
            feed.close()
        }, 10000)
    }
)
```

### Feed calling styles

Feed services support both feed subscribers and request/response callers. This is possible because of the "initial" method of the feed object. Let's see an example of a feed and how to use it with both calling models.

```js
var list = [],
    subscribers = []

api.service('list').extend(
{
    push: function (params, done)
    {
        list.push(params.value)
        subscribers.forEach(function (s)
        {
            s.emit('insert', value)
        })
        done()
    },
    
    get: function (params)
    {
        return {
            initial: function (done)
            {
                done(null, list)
            },
            changes: function (subscriber, done)
            {
                subscribers.push(subscriber)
                
                return {
                    close: function ()
                    {
                        subscribers.splice(subscribers.indexOf(subscriber), 1)
                    }
                }
            }
        }
    }
})

// Now we can use the service like this (request/response)

api.service('list')
        .push({ value: 'foo' })
        .get({}, function (err, result)
        {
            console.log(result) // ['foo']
        })

// Or like this (subscriber)

api.service('list')
        .get(
            {
                subscriber: {
                    emit: function (event, value)
                    {
                        if (event == 'initial')
                        {
                            console.log(value) // ['foo']
                        }
                        else
                        {
                            console.log(event, value) // 'insert' 'bar'...'insert' 'baz'...
                        }
                    }
                }
            }
        )
        .push({ value: 'bar' })
        .push({ value: 'baz' })

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

Landho can expose services over web sockets. Here is an example using [ws](https://github.com/websockets/ws).

```js
var landho = require('landho'),
    api = landho(),
    WebSocket = require('ws'),
    wss = new WebSocket.Server({ port:5000 })

api.configure(landho.socket(wss))
```

That's all that's needed. To call methods over a websocket, send a message including a service method name, data and a unique id. Listen for feed events having the same id you sent in the initial call. This is how it's done regardless of whether you are calling a feed method or a request/response method. Below we show a raw WebSocket client, but you will probably have an easier time using [landho-client](https://github.com/elishacook/landho-client).

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

#### Application.configure(function:plugin) -> Application

Configure an application to use the given plugin. Plugins are functions which take an application as an argument and modify them.

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

The keys of the configuration object are the names of the service methods and the values are their implementations. There are two ways to implement a service method. First, the standard node continuation style using a `done()` callback that takes an error as the first argument and a result as the second, like our `add()` and `multiply` examples above. The second way is to return a feed, like this:

```js
var api = landho()
api.service('bar', {
    counter: function (params)
    {
        return {
            initial: function (done)
            {
                done(null, 0)
            },
            changes: function (subscriber, done)
            {
                var counter = 0
                var interval = setTimeout(function ()
                {
                    subscriber.emit('update', ++counter)
                }, 1000)
                done(null, {
                    close: function ()
                    {
                        clearInterval(interval)
                    }
                })
            }
        }
    }
})
```

##### Feed methods

###### Feed.initial(function:done(mixed:error, mixed:result)) -> null

Takes a `done()` callback and calls it either with an error or a value representing the initial state of the feed.

###### Feed.changes(object:subscriber, function:done(mixed:error, mixed:result)) -> null

The `subscriber` is an object with an `emit()` method that the feed may use to notify the subscriber of changes. The `done()` callback is called by the feed either with an error as the first argument or with a feed handle as the second argument. The feed handle has one method called `close` that indicates the caller no longer wishes to receive changes. The feed must terminate messages to the subscriber when the `close` method is called.

*__TIP:__ Keep in mind that because of the asynchronous nature of feeds it is quite possible for messages to be received after a call to `close()`. This is especially true if you introduce any latency between the feed and the subscriber like, for instance, connecting them over a network.*

##### `params` object

The first argument to a service method is always a `params` object. This is all the parameters set by the caller then run through the `before` hooks.

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