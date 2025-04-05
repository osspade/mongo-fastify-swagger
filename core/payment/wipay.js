import { events,service } from '../index.js'
import axios from 'axios';

export default class wipay {



    constructor(util) {
        this.routes(util, this.constructor.name)

    }

    routes(util, _collection) {
        const _service = new service();

        const payment_url = {
            "live": "https://wipayfinancial.com/v1/gateway_live",
            "sandbox": "https://sandbox.wipayfinancial.com/v1/gateway"
        }
        const developer_id = {
            "live": null,
            "sandbox": 1
        }
        const collection = util.db.collection('order');


        util.fastify.route({
            method: 'GET',
            url: `/${_collection}/:mode/:order_id`,
            schema: {
                tags: [_collection],
                description: 'Initialize a WiPay payment for an order',
                params: {
                    type: 'object',
                    required: ['mode', 'order_id'],
                    properties: {
                        mode: { 
                            type: 'string', 
                            enum: ['live', 'sandbox'],
                            description: 'Payment mode - either "live" for production or "sandbox" for testing' 
                        },
                        order_id: { 
                            type: 'string', 
                            description: 'Unique identifier of the order to be paid for' 
                        }
                    }
                },
                security: [{ apiauth: [] }],
                response: {
                    200: {
                        type: 'object',
                        description: 'WiPay payment initialization response',
                        properties: {
                            wipay: {
                                oneOf: [
                                    {
                                        type: 'string',
                                        description: 'URL to redirect the user to for payment completion'
                                    },
                                    {
                                        type: 'object',
                                        description: 'Response from WiPay payment initialization',
                                        properties: {
                                            url: { type: 'string', description: 'Payment URL' },
                                            transaction_id: { type: 'string', description: 'WiPay transaction ID' },
                                            message: { type: 'string', description: 'Response message' }
                                        }
                                    }
                                ]
                            }
                        }
                    },
                    400: {
                        type: 'object',
                        description: 'Payment initialization error',
                        properties: {
                            message: { type: 'string', description: 'Error message' },
                            error: { type: 'string', description: 'Error details' }
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
                const { mode, order_id } = request.params
                const  result = await _service.populateResult(util,await collection.findOne({ _id: new util.fastify.mongo.ObjectId(order_id) }))
                const formdata = new FormData()
                let grand_total = 0;   
            
                result['product$product'].forEach(product => {
                    grand_total = grand_total+product.total
                 });
                 
                 const wipay = {
                    "total": grand_total,
                    "phone": result['account$account'].profile.phone,
                    "email": result['account$account'].profile.email,
                    "name": `${result['account$account'].profile.firstname} ${result['account$account'].profile.lastname}`, 
                    "order_id": result._id,
                    "developer_id": developer_id[mode]
                }
                 
                formdata.append('return_url', `http://${request.headers.host}/${_collection}/callback`);
                formdata.append('developer_id', developer_id[mode]);
                
                for (const field in wipay) {
                    formdata.append(field, wipay[field])
                }
    
                try {
                    const ax = await axios.post(payment_url[mode], formdata, {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                        }
                    })
    
                    let result = {}
                    if (ax.request.res.responseUrl == payment_url[mode]) {
                        result = { "wipay": ax.data }
    
                    } else {
                        result = { "wipay": ax.request.res.responseUrl }
                    }

                    new events().log(util, {
                        'url': `/${_collection}/${mode}/${order_id}`,
                        'account$account': { _id: new util.fastify.mongo.ObjectId(request.auth._id) },
                        ...result
                    })
                    
                    reply.status(200).send(result);


                } catch (err) {
                    reply.status(400).send(err);
                }
            }
        })

        util.fastify.route({
            method: 'GET',
            url: `/${_collection}/callback`,
            schema: {
                tags: [_collection],
                description: 'Callback endpoint for WiPay payment processing notifications',
                querystring: {
                    type: 'object',
                    properties: {
                        status: { 
                            type: 'string', 
                            description: 'Status of the payment (e.g., "success", "failed")' 
                        },
                        transaction_id: { 
                            type: 'string', 
                            description: 'WiPay transaction ID reference' 
                        },
                        order_id: { 
                            type: 'string', 
                            description: 'Original order ID that was paid for' 
                        },
                        date: { 
                            type: 'string', 
                            format: 'date-time',
                            description: 'Date and time of the payment transaction' 
                        },
                        resasonDescription: { 
                            type: 'string', 
                            description: 'Reason or description for the payment status (misspelled in original API)' 
                        }
                    }
                },
                response: {
                    200: {
                        type: 'object',
                        description: 'WiPay callback response',
                        properties: {
                            status: { 
                                type: 'string', 
                                description: 'Status of the payment' 
                            },
                            transaction_id: { 
                                type: 'string', 
                                description: 'WiPay transaction ID reference' 
                            },
                            order_id: { 
                                type: 'string', 
                                description: 'Order ID that was paid for' 
                            },
                            date: { 
                                type: 'string', 
                                format: 'date-time',
                                description: 'Date and time of the payment transaction' 
                            },
                            resasonDescription: { 
                                type: 'string', 
                                description: 'Reason or description for the payment status (misspelled in original API)' 
                            }
                        }
                    }
                }
            },
            handler: async function (request, reply) {
           
              let {status,transaction_id,order_id,date,resasonDescription} = request.query

              await collection.updateOne(
                  { "_id": new util.fastify.mongo.ObjectId(order_id) },
                  { '$push': { "log":  request.query} },
                  { 'upsert': true }
              )

            new events().log(util, {
                'url': `/${_collection}/callback/`,
                ...request.query
            })

             reply.status(200).send({status,transaction_id,order_id,date,resasonDescription});
                

            }
        })
    }

}

