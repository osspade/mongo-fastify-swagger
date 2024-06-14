import { service, events } from './index.js'

export default class common {

    constructor(util, path) {
        this.routes(util, path)

    }

    routes(util, _collection) {

        const collection = util.db.collection(_collection);
        const _service = new service();


        const addPropertyHandler = async (request, reply) => {

            let { id, property } = request.params
            const _id = new util.fastify.mongo.ObjectId(id)

            let add = {}
            add[property] = request.body;
            try {
                await collection.updateOne(
                    { "_id": _id },
                    { '$push': add },
                    { 'upsert': true }
                )

                let result = {}
                result[_collection] = _id
                result[property] = Object.keys(request.body)

                let eventPayload = {
                    'url': `/${_collection}/${id}/${property}`,
                    'account$account': { _id: new util.fastify.mongo.ObjectId(request.auth._id) },
                    ...result
                }

                new events().log(util, eventPayload)

                reply.status(200).send(result);

            } catch (e) {
                reply.status(400).send({ "error": e });
            }

        }

        const deleteHandler = async (request, reply) => {
            let { id, property } = request.params
            try {

                let eventPayload = {
                    'url': `/${_collection}/${id}/${property}`,
                    'account$account': { _id: new util.fastify.mongo.ObjectId(request.auth._id) },
                }

                if (property) {
                    let prop = {}
                    prop[property] = 1

                    await collection.updateOne(
                        { "_id": new util.fastify.mongo.ObjectId(id) },
                        { $unset: prop }
                    )


                } else {
                    await collection.deleteOne({ "_id": new util.fastify.mongo.ObjectId(id) });
                }


                new events().log(util, eventPayload)

                reply.status(200).send({ "_id": new util.fastify.mongo.ObjectId(id), "delete": [property] });

            } catch (e) {
                reply.status(400).send({ "error": e });
            }

        }

        const updateHandler = async (request, reply) => {

            let { id } = request.params
            const _id = new util.fastify.mongo.ObjectId(id)

            try {

                collection.updateOne(
                    { "_id": _id },
                    { $set: request.body },
                    { upsert: true }
                )

                let result = {}
                result[_collection] = _id
                result["updated"] = Object.keys(request.body)

                let eventPayload = {
                    'url': `/${_collection}/${id}`,
                    'account$account': { _id: new util.fastify.mongo.ObjectId(request.auth._id) },
                    ...result
                }

                new events().log(util, eventPayload)

                reply.status(200).send(result);

            } catch (e) {
                reply.status(400).send({ "error": e });
            }
        }

        const getHandler = async (request, reply) => {

            const { id, property } = request.params;
            const objPath = (t, path) => path.split(".").reduce((r, k) => r?.[k], t);
            const projection = (collection) => {
                if (collection.namespace.split(".")[1] == "account") {
                    return { projection: { _id: 1, roles: 1, profile: 1 } }
                } else {
                    return {}
                }
            }
            return collection.findOne({ "_id": new util.fastify.mongo.ObjectId(id) }, projection(collection)).then(async result => {

                result = await _service.populateResult(util, result)

                if (!property) {
                    reply.status(200).send(result);
                } else {

                    let propResult = {};
                    let prop = property.split(".").slice(-1)[0]
                    result = objPath(result, property)

                    if (prop.indexOf('$') !== -1) {
                        propResult[prop] = await _service.populate(util, result, prop.split("$")[1])
                        reply.status(200).send(propResult);
                    }


                    if (result) {
                        propResult[prop] = result
                        reply.status(200).send(propResult);
                    }
                }

            })

        }

        util.fastify.route({
            method: 'GET',
            url: `/${_collection}/all`,
            schema: {
              tags: [_collection],
              description: `Get All ${_collection}`,
              security: [{ apiauth: [] }],
            },
            preHandler: util.fastify.auth([util.fastify.authenticate]),
            handler: async function (request, reply) {
      
              new events().log(util, {
                'url': `/${_collection}/all`,
                'account$account': { _id: new util.fastify.mongo.ObjectId(request.auth._id) },
              })
      
              reply.status(200).send(await collection.find({},{ projection: { _id:1, profile: 1 } }).toArray());
            }
          })
      

        util.fastify.route({
            method: 'GET',
            url: `/${_collection}/:id`,
            schema: {
                tags: [_collection],
                description: `Get ${_collection} ID`,
                security: [{ apiauth: [] }],
            },
            preHandler: util.fastify.auth([util.fastify.authenticate]),
            handler: getHandler
        })

        util.fastify.route({
            method: 'GET',
            url: `/${_collection}/:id/:property`,
            schema: {
                tags: [_collection],
                description: 'Get ID Property (with "." property populate)',
                security: [{ apiauth: [] }],
            },
            preHandler: util.fastify.auth([util.fastify.authenticate]),
            handler: getHandler
        })

        util.fastify.route({
            method: 'PUT',
            url: `/${_collection}/:id/:property`,
            schema: {
                tags: [_collection],
                description: `Add Object to Array of selected property by id`,
                body: {
                    type: 'object'
                },
                security: [{ apiauth: [] }],
            },
            preHandler: util.fastify.auth([util.fastify.authenticate]),
            handler: addPropertyHandler
        })

        util.fastify.route({
            method: 'PUT',
            url: `/${_collection}/:id`,
            schema: {
                tags: [_collection],
                description: `${_collection} Update by ID`,
                body: {
                    type: 'object'
                },
                security: [{ apiauth: [] }],
            },
            preHandler: util.fastify.auth([util.fastify.authenticate]),
            handler: updateHandler
        })

        util.fastify.route({
            method: 'DELETE',
            url: `/${_collection}/:id`,
            schema: {
                tags: [_collection],
                description: `${_collection} Delete`,
                security: [{ apiauth: [] }],
            },
            preHandler: util.fastify.auth([util.fastify.authenticate]),
            handler: deleteHandler
        })
///////////////////////////////////////////
        util.fastify.route({
            method: 'DELETE',
            url: `/${_collection}/:id/:property`,
            schema: {
                tags: [_collection],
                description: `Delete property from ${_collection} by ID`,
                security: [{ apiauth: [] }],
            },
            preHandler: util.fastify.auth([util.fastify.authenticate]),
            handler: deleteHandler
        })

        util.fastify.route({
            method: 'PUT',
            url: `/${_collection}/pathString/:id/:path`,
            schema: {
                tags: [_collection],
                description: `Update ${_collection} Path with a String`,
                body: {
                    type: 'object',
                    properties: {
                        setString: { type: 'string' }
                    }
                },
                security: [{ apiauth: [] }],
            },
            preHandler: util.fastify.auth([util.fastify.authenticate]),
            handler: async function (request, reply) {
                const { id, path } = request.params;

                const filter = { _id: new util.fastify.mongo.ObjectId(id) }
                let update = { '$set': {} }
                update['$set'][path] = request.body.setString
                await collection.updateOne(
                    filter,
                    update,
                    {upsert:true}
                )

                reply.status(200).send({ "message": `List Updated with String` });

            }
        })

        util.fastify.route({
            method: 'PUT',
            url: `/${_collection}/pathObject/:id/:path`,
            schema: {
                tags: [_collection],
                description: `Update ${_collection} List item with a Object`,
                body: {
                    type: 'object',
                    properties:{}
                },
                security: [{ apiauth: [] }],
            },
            preHandler: util.fastify.auth([util.fastify.authenticate]),
            handler: async function (request, reply) {
                const { id, path } = request.params;

                const filter = { _id: new util.fastify.mongo.ObjectId(id) }
                let update = { '$set': {} }
                update['$set'][path] = request.body
                await collection.updateOne(
                    filter,
                    update,
                    {upsert:true}
                )

                reply.status(200).send({ "message": `List Updated with Object` });

            }
        })

        util.fastify.route({
            method: 'PUT',
            url: `/${_collection}/pathList/:id/:path`,
            schema: {
                tags: [_collection],
                description: `Update ${_collection} Path item with a List`,
                body: {
                    type: 'array',
                    items: { type: "string" }
                },
                security: [{ apiauth: [] }],
            },
            preHandler: util.fastify.auth([util.fastify.authenticate]),
            handler: async function (request, reply) {
                const { id, path } = request.params;

                const filter = { _id: new util.fastify.mongo.ObjectId(id) }
                let update = { '$set': {} }
                update['$set'][path] = request.body
                await collection.updateOne(
                    filter,
                    update,
                    {upsert:true}
                )

                reply.status(200).send({ "message": `List Updated with Object` });

            }
        })

    }
}