export const validation = (schema) => {
    return (req, res, next) => {
        let errors = [];

        for (const key of Object.keys(schema)) {
            if (req[key]) {
                const { error } = schema[key].validate(req[key], { abortEarly: false });
                if (error) {
                    error.details.forEach(detail => {
                        errors.push(detail.message);
                    });
                }
            }
        }

        if (errors.length > 0) {
            return res.status(400).json({ message: "Validation error", details: errors });
        }

        next();
    };
};