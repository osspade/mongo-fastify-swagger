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
                description: `Get /${_collection}`,
                security: [{ apiauth: [] }],
            },
            preHandler: util.fastify.auth([util.fastify.authenticate]),
            handler: async function (request, reply) {                

                reply.status(200).send(await collection.find({ }, { projection: { _id: 1, details: 1 } }).toArray());
            }
        })

    }
}
