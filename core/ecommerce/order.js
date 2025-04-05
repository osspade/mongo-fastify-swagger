import { events, service, common } from '../index.js'

export default class order {

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
                description: 'Create a new order with product references',
                body: {
                    type: 'object',
                    required: ['product$product'],
                    properties: {
                        'product$product': { 
                            type: 'array', 
                            description: 'Products included in this order',
                            items: { 
                                type: 'object',
                                properties: {
                                    _id: { 
                                        type: 'string', 
                                        description: 'Product ID reference' 
                                    },
                                    quantity: { 
                                        type: 'integer', 
                                        description: 'Quantity of this product in the order',
                                        default: 1
                                    }
                                }
                            }
                        },
                        'paymentMethod': { 
                            type: 'string', 
                            description: 'Method of payment',
                            enum: ['credit', 'debit', 'paypal', 'crypto'],
                            default: 'credit'
                        },
                        'shippingAddress': { 
                            type: 'object', 
                            description: 'Shipping address information',
                            properties: {
                                street: { type: 'string', description: 'Street address' },
                                city: { type: 'string', description: 'City' },
                                state: { type: 'string', description: 'State or province' },
                                zip: { type: 'string', description: 'ZIP or postal code' },
                                country: { type: 'string', description: 'Country' }
                            }
                        }
                    }
                },
                security: [{ apiauth: [] }],
                response: {
                    200: {
                        type: 'object',
                        description: 'Order creation successful',
                        properties: {
                            acknowledged: { 
                                type: 'boolean', 
                                description: 'Whether the operation was acknowledged by the database' 
                            },
                            insertedId: { 
                                type: 'string', 
                                description: 'ID of the newly created order' 
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
                    request.body['account$account'] = { _id: new util.fastify.mongo.ObjectId(request.auth._id) }
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
                description: 'Retrieve all orders for the authenticated user',
                security: [{ apiauth: [] }],
                response: {
                    200: {
                        type: 'array',
                        description: 'List of user orders',
                        items: {
                            type: 'object',
                            properties: {
                                _id: { type: 'string', description: 'Unique order identifier' },
                                'product$product': { 
                                    type: 'array', 
                                    description: 'Products in this order',
                                    items: { 
                                        type: 'object',
                                        properties: {
                                            _id: { type: 'string', description: 'Product ID' },
                                            quantity: { type: 'integer', description: 'Quantity ordered' },
                                            en: {
                                                type: 'object',
                                                description: 'Product details in English (populated)',
                                                properties: {
                                                    title: { type: 'string' },
                                                    description: { type: 'string' }
                                                }
                                            },
                                            total: { type: 'number', description: 'Product price' }
                                        }
                                    }
                                },
                                'account$account': { 
                                    type: 'object', 
                                    description: 'Reference to the account that placed the order',
                                    properties: {
                                        _id: { type: 'string', description: 'Account ID' }
                                    }
                                },
                                'paymentMethod': { type: 'string', description: 'Method of payment used' },
                                'shippingAddress': { 
                                    type: 'object', 
                                    description: 'Shipping address information' 
                                },
                                'status': { 
                                    type: 'string', 
                                    description: 'Current order status',
                                    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
                                    default: 'pending'
                                },
                                'created': { 
                                    type: 'string', 
                                    format: 'date-time',
                                    description: 'Order creation timestamp' 
                                }
                            }
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
              reply.status(200).send(await collection.find({"account$account._id": new util.fastify.mongo.ObjectId(request.auth._id) }).toArray());
            }
          })

    }

}