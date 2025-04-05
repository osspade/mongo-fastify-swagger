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
                description: 'Create a new product with multilingual support and pricing information',
                body: {
                    type: 'object',
                    required: ["en", "total", "subscription"],
                    properties: {
                        en: {
                            type: 'object',
                            required: ["title", "description"],
                            description: 'English product information',
                            properties: {
                                title: { 
                                    type: 'string', 
                                    description: 'Product title in English',
                                    default: "Bicycle" 
                                },
                                description: { 
                                    type: 'string', 
                                    description: 'Product description in English',
                                    default: "Mountain and Street" 
                                }
                            }
                        },
                        fr: {
                            type: 'object',
                            required: ["title", "description"],
                            description: 'French product information',
                            properties: {
                                title: { 
                                    type: 'string', 
                                    description: 'Product title in French',
                                    default: "Vélo" 
                                },
                                description: { 
                                    type: 'string', 
                                    description: 'Product description in French',
                                    default: "Montagne et Rue" 
                                }
                            }
                        },
                        total: { 
                            type: 'number', 
                            description: 'Product price',
                            default: 59.99 
                        },
                        subscription: { 
                            type: 'object', 
                            description: 'Subscription details if product is subscription-based',
                            properties: {} 
                        },
                        upload$upload: { 
                            type: 'array', 
                            description: 'References to uploaded product images or files',
                            items: { 
                                type: 'object',
                                properties: {
                                    _id: { type: 'string', description: 'Uploaded file ID' }
                                }
                            } 
                        }
                    }
                },
                security: [{ apiauth: [] }],
                response: {
                    200: {
                        type: 'object',
                        description: 'Product creation successful',
                        properties: {
                            acknowledged: { 
                                type: 'boolean', 
                                description: 'Whether the operation was acknowledged by the database' 
                            },
                            insertedId: { 
                                type: 'string', 
                                description: 'ID of the newly created product' 
                            }
                        }
                    },
                    400: {
                        type: 'object',
                        description: 'Creation error',
                        properties: {
                            error: { type: 'object', description: 'Error details' }
                        }
                    },
                    401: {
                        type: 'object',
                        description: 'Authentication error',
                        properties: {
                            statusCode: { type: 'integer' },
                            error: { type: 'string' },
                            message: { type: 'string' }
                        }
                    }
                }
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
                description: 'Retrieve all products',
                response: {
                    200: {
                        type: 'array',
                        description: 'List of all products',
                        items: {
                            type: 'object',
                            properties: {
                                _id: { type: 'string', description: 'Unique product identifier' },
                                en: {
                                    type: 'object',
                                    description: 'English product information',
                                    properties: {
                                        title: { type: 'string', description: 'Product title in English' },
                                        description: { type: 'string', description: 'Product description in English' }
                                    }
                                },
                                fr: {
                                    type: 'object',
                                    description: 'French product information',
                                    properties: {
                                        title: { type: 'string', description: 'Product title in French' },
                                        description: { type: 'string', description: 'Product description in French' }
                                    }
                                },
                                total: { type: 'number', description: 'Product price' },
                                subscription: { type: 'object', description: 'Subscription details' },
                                upload$upload: { 
                                    type: 'array', 
                                    description: 'References to product images or files',
                                    items: { 
                                        type: 'object',
                                        properties: {
                                            _id: { type: 'string' }
                                        }
                                    }
                                },
                                created: { 
                                    type: 'string', 
                                    format: 'date-time',
                                    description: 'Product creation timestamp' 
                                }
                            }
                        }
                    }
                }
            },
            handler: async function (request, reply) {      
              reply.status(200).send(await collection.find({}).toArray());
            }
          })

    }

}