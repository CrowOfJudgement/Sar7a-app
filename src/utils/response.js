
export const successResponse = (res, { message = "Success", data = {}, status = 200 } = {}) => {
    return res.status(status).json({
        success: true, 
        message,
        data
    });
};