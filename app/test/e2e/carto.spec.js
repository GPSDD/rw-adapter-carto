const logger = require('logger');
const assert = require('assert');
const nock = require('nock');
const chai = require('chai');
const chaiHttp = require('chai-http');
let requester;

chai.use(chaiHttp);


require('should');

const dataset = {
    data: {
        id: '00c47f6d-13e6-4a45-8690-897bdaa2c723',
        attributes: {
            connectorUrl: 'https://wri-01.carto.com/tables/wdpa_protected_areas/table',
            table_name: 'wdpa_protected_areas'
        }
    }
};

const fields = [{
    field1: {
        type: 'number'
    },
    the_geom: {
        type: 'geometry'
    }
}];

describe('E2E test', () => {
    before(() => {

        nock(`${process.env.CT_URL}`)
            .persist()
            .post(`/api/v1/microservice`)
            .reply(200);

        const server = require('../../src/app');
        requester = chai.request(server).keepOpen();

        nock(`https://wri-01.carto.com`)
            .get(encodeURI(`/api/v2/sql?q=select * from ${dataset.data.attributes.table_name} limit 0`))
            .reply(200, {
                rows: [],
                fields
            });
        nock(`${process.env.CT_URL}`)
            .get(encodeURI(`/v1/convert/sql2SQL`))
            .query({ sql: 'update table', experimental: 'true', raster: 'false' })
            .reply(400, {
                status: 400,
                detail: 'Malformed query'
            });
    });

    it('Get fields correctly', async () => {
        let response = null;
        try {
            response = await requester
                .post(`/api/v1/carto/fields/${dataset.data.id}`)
                .send({
                    dataset,
                    loggedUser: null
                });
        } catch (e) {
            logger.error(e);
            assert(false, 'Exception thrown');
        }
        response.status.should.equal(200);
        response.body.should.have.property('tableName');
        response.body.tableName.should.equal(dataset.data.attributes.table_name);
        response.body.should.have.property('fields');
        response.body.fields.should.deepEqual(fields);
    });

    it('Do query with query invalid', async () => {
        const response = await requester
            .post(`/api/v1/carto/query/${dataset.data.id}?sql=update table`)
            .send({
                dataset,
                loggedUser: null
            });
        response.status.should.equal(400);
        response.body.should.have.property('status');
        response.body.status.should.equal(400);
        response.body.should.have.property('detail');
        response.body.detail.should.equal('Malformed query');

    });

    after(() => {
    });
});
