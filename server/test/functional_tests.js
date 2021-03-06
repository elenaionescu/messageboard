'use strict';

const chaiHttp = require('chai-http');
const chaiJsonSchema = require('chai-json-schema');
const server = require('../server');
const chai = require('chai');
const { assert, expect } = chai;
const mongoose = require('mongoose');

chai.use(chaiHttp);
chai.use(chaiJsonSchema);

describe('Functional Tests', () => {
    let userData, userSchema, paginationDataSchema, errorSchema;

    before(() => {
        userData = {
            name: 'Victor',
            surveyStatus: 'Scheduled',
            type: 'Candidate',
            location: 'Las Vegas, NV',
            role: 'Engineer'
        };
        userSchema = {
            title: 'user schema',
            type: 'object',
            required: ['name', 'surveyStatus', 'type', 'location', 'role'],
            properties: {
                ['_id']: { type: 'string' },
                name: { type: 'string' },
                surveyStatus: { type: 'string' },
                type: { type: 'string' },
                location: { type: 'string' },
                role: { type: 'string' }
            }
        };
        paginationDataSchema = {
            title: 'pagination data schema',
            type: 'object',
            required: ['docs', 'total', 'limit', 'page', 'pages'],
            properties: {
                docs: {
                    type: 'array',
                    items: userSchema
                },
                total: { type: 'number' },
                limit: { type: 'number' },
                page: { type: 'number' },
                pages: { type: 'number' }
            }
        };
        errorSchema = {
            title: 'error schema',
            type: 'object',
            required: ['error'],
            properties: {
                error: {
                    type: 'object',
                    required: ['message'],
                    properties: {
                        message: { type: 'string' }
                    }
                }
            }
        }
    });

    // BDD style

    describe('API ROUTING FOR /api/users/paginated', () => {
        describe('GET', () => {
            it('should get pagination data', (done) => {
                chai.request(server)
                    .get('/api/users/paginated')
                    .end((err, { status, body }) => {
                        expect(status).to.equal(200);
                        expect(body).to.be.jsonSchema(paginationDataSchema);
                        done();
                    });
            });

            it('should handle query string searches', (done) => {
                chai.request(server)
                    .get('/api/users/paginated')
                    .query({
                        filter: 'type',
                        filterVal: 'Employee'
                    })
                    .end((err, { status, body }) => {
                        expect(status).to.equal(200);
                        expect(body).to.be.jsonSchema(paginationDataSchema);
                        expect(body.docs[0].type).to.equal('Employee');
                        expect(body.docs[body.docs.length - 1].type).to.equal('Employee');
                        done();
                    });
            })
        });
    });

    // TDD style
    describe('API ROUTING FOR /api/users', () => {
        describe('GET', () => {
            it('get array of users', (done) => {
                chai.request(server)
                    .get('/api/users')
                    .end((err, { status, body }) => {
                        assert.equal(status, 200);
                        assert.isArray(body);
                        assert.jsonSchema(body[0], userSchema);
                        done();
                    });
            });
        });

        describe('POST', () => {
            it('create new user', (done) => {
                chai.request(server)
                    .post('/api/users')
                    .send(userData)
                    .end((err, { status, body }) => {
                        assert.equal(status, 201);
                        assert.jsonSchema(body, userSchema);
                        for (let property in userData) {
                            assert.equal(body[property], userData[property]);
                        }
                        done();
                    });
            });

            it('should fail with invalid data', (done) => {
                chai.request(server)
                    .post('/api/users')
                    .send({
                        invalidProp: ''
                    })
                    .end((err, { status, body }) => {
                        assert.equal(status, 400);
                        assert.jsonSchema(body, errorSchema);
                        assert.include(body.error.message, 'validation failed');
                        done();
                    });
            });
        });
    });

    // BDD style
    describe('API ROUTING FOR /api/users/:userId', () => {
        let userId;

        before((done) => {
            chai.request(server)
                .post('/api/users')
                .send(userData)
                .end((err, { body }) => {
                    userId = body._id;
                    done();
                });
        });

        describe('GET', () => {
            it('should return the correct user doc', (done) => {
                chai.request(server)
                    .get(`/api/users/${userId}`)
                    .end((err, { status, body }) => {
                        expect(status).to.equal(200);
                        expect(body).to.be.jsonSchema(userSchema);
                        for (let property in userData) {
                            expect(body[property]).to.be.equal(userData[property]);
                        }
                        done();
                    });
            });

            it('should return an error if provided invalid ID syntax', (done) => {
                chai.request(server)
                    .get('/api/users/invalidId')
                    .end((err, { status, body }) => {
                        expect(status).to.equal(400);
                        expect(body).to.be.jsonSchema(errorSchema);
                        expect(body.error.message).to.include('invalidId');
                        done();
                    });
            });

            it('should return an error if user not found with valid ID syntax', (done) => {
                chai.request(server)
                    .get(`/api/users/${mongoose.Types.ObjectId()}`)
                    .end((err, { status, body }) => {
                        expect(status).to.equal(404);
                        expect(body).to.be.jsonSchema(errorSchema);
                        done();
                    });
            });
        });

        describe('PUT', () => {
            let updatedUserData, updateSchema;

            before(() => {
                updatedUserData = {
                    name: 'New Name',
                    selected: true,
                    surveyStatus: 'completed',
                    type: 'Employee',
                    location: 'San Francisco, CA',
                    role: 'Lead Software Engineer'
                };
                updateSchema = {
                    title: 'update schema',
                    type: 'object',
                    required: ['n', 'nModified', 'ok'],
                    properties: {
                        n: { type: 'number' },
                        nModified: { type: 'number' },
                        ok: { type: 'number' }
                    }
                }
            });

            it('should handle updating any user property', (done) => {
                chai.request(server)
                    .put(`/api/users/${userId}`)
                    .send(updatedUserData)
                    .end((err, { status, body }) => {
                        expect(status).to.equal(200);
                        expect(body).to.be.jsonSchema(updateSchema);
                        for (let property in body) {
                            expect(body[property]).to.equal(1);
                        }
                        done();
                    });
            });
            it('should not be able to update immutable _id', (done) => {
                chai.request(server)
                    .put(`/api/users/${userId}`)
                    .send({
                        _id: mongoose.Types.ObjectId()
                    })
                    .end((err, { status, body }) => {
                        expect(status).to.equal(400);
                        expect(body).to.have.property('error');
                        expect(body.error.message).to.include('immutable');
                        done();
                    });
            });
        });

        describe('DELETE', () => {
            it('should return doc that was deleted', (done) => {
                chai.request(server)
                    .delete(`/api/users/${userId}`)
                    .end((err, { status, body }) => {
                        expect(status).to.equal(200);
                        expect(body).to.be.jsonSchema(userSchema);
                        done();
                    });
            });
            it('should fail to find deleted doc', (done) => {
                chai.request(server)
                    .get(`/api/users/${userId}`)
                    .end((err, { status, body }) => {
                        expect(status).to.equal(404);
                        expect(body).to.be.jsonSchema(errorSchema);
                        expect(body.error.message).to.equal('Not Found');
                        done();
                    })
            })
        });
    });
});
