import Joi from 'joi';

export const signUpSchema = {
    body: Joi.object({
        firstName: Joi.string().min(2).max(30).required(),
        lastName: Joi.string().min(2).max(30).required(),
        email: Joi.string().email().required(),
        password: Joi.string().min(6).required(),
        age: Joi.number().integer().min(0).max(120),
        gender: Joi.string().valid('male', 'female').required() 
    }) 
};

export const signInSchema = {
    body: Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().min(6).required()
    }), 
    query: Joi.object({ 
        email: Joi.string().email().required(),
        password: Joi.string().min(6).required()
    }) 
};