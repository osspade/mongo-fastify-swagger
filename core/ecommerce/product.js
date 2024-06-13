import { events, service, common } from '../index.js'

export default class product {

    constructor(util) {

        this.routes(util, this.constructor.name)
        new common(util, this.constructor.name)
    }

    routes(util, _collection) {

        const collection = util.db.collection(_collection);

        util.fastify.route({
            method: 'PUT',
            url: `/${_collection}/create`,
            schema: {
                tags: [_collection],

                description: `${_collection} create`,
                body: {
                    type: 'object',
                    required: ["en","total","subscription"],
                    properties: {
                        en: {
                            type: 'object',
                            required: ["title", "description"],
                            properties: {
                                title: { type: 'string', default: "Bicycle" },
                                description: { type: 'string', default: "Mountain and Street" }
                            }
                        },
                        fr: {
                            type: 'object',
                            required: ["title", "description"],
                            properties: {
                                title: { type: 'string', default: "Vélo" },
                                description: { type: 'string', default: "Montagne et Rue" }
                            }
                        },

                        total: { type: 'number', default: 59.99 },
                        subscription: { type: 'object', properties: {} },
                        upload$upload: { type: 'array', items: { type: 'object' } }


                    }
                },
                security: [{ apiauth: [] }],
            },
            preHandler: util.fastify.auth([util.fastify.authenticate]),
            handler: async function (request, reply) {

                try {

                    let result = await collection.insertOne(request.body)
                    let eventPayload = {
                        'url': `/${_collection}/create/`,
                        'account$account': { _id: new util.fastify.mongo.ObjectId(request.auth._id) },
                        ...result
                    }

                    new events().log(util, eventPayload)

                    reply.status(200).send(result);

                } catch (e) {
                    reply.status(400).send({ "error": e });
                }

            }
        })

        util.fastify.route({
            method: 'GET',
            url: `/${_collection}`,
            schema: {
              tags: [_collection],
              description: _collection,
            },
            handler: async function (request, reply) {      
              reply.status(200).send(await collection.find({}).toArray());
            }
          })

    }

}