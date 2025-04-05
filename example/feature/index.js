import { events, common } from "mongo-fastify-swagger"
export default class feature {

    constructor(util) {

        this.routes(util, this.constructor.name)
        new common(util, this.constructor.name)
    }

    routes(util, _collection) {

        const collection = util.db.collection(_collection)

        util.fastify.route({
            method: 'GET',
            url: `/${_collection}`,
            schema: {
                tags: [_collection],
                description: `Retrieve all ${_collection} records with basic information`,
                security: [{ apiauth: [] }],
                response: {
                    200: {
                        type: 'array',
                        description: `List of all ${_collection} records with basic fields`,
                        items: {
                            type: 'object',
                            properties: {
                                _id: { 
                                    type: 'string', 
                                    description: 'Unique identifier for the feature record' 
                                },
                                details: { 
                                    type: 'object', 
                                    description: 'Basic details of the feature' 
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
                    },
                    500: {
                        type: 'object',
                        description: 'Server error',
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
                    const features = await collection.find({}, { projection: { _id: 1, details: 1 } }).toArray();
                    reply.status(200).send(features);
                } catch (error) {
                    reply.status(500).send({ 
                        statusCode: 500,
                        error: "Internal Server Error", 
                        message: "Error retrieving features" 
                    });
                }
            }
        })

    }
}
