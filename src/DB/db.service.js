

export const create=async({model, data,options ={}} ={})=>{
    return await model.create(data);
}


    export const findone = async ({ model, filter, options = {} } = {}) => {
    let query = model.findOne(filter); 

    if (options.populate) {
        query = query.populate(options.populate);
    }
    if (options.select) {
        query = query.select(options.select);
    }

    return await query.exec(); 
};

 export const find = async ({ model, filter, options = {} } = {}) => {
    let query = model.find(filter); 

    if (options.populate) {
        query = query.populate(options.populate);
    }
    if (options.select) {
        query = query.select(options.select);
    }

    return await query.exec(); 
};

 export const updateOne = async ({ model, filter={}, update={}, options = {} } = {}) => {
    let query = model.updateOne(filter, update, {runValidators:true, ...options}); 

   
    return await query.exec(); 
};


 export const findOneAndUpdate = async ({ model, filter={}, update={}, options = {} } = {}) => {
    let query = model.findOneAndUpdate(filter, update, {new:true, runValidators:true, ...options}); 

   
    return await query.exec(); 
};



