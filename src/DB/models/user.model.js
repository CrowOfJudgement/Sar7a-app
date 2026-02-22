import mongoose from "mongoose";

const userSchema=new mongoose.Schema({
firstName:{
    type:String,
    required:true,
    minlength:3,
    trim:true
},
lastName:{
    type:String,
    required:true,
    minlength:3,
    trim:true
},
email:{
     type:String,
    required:true,
unique:true,
    trim:true  
},
password:{
       type:String,
    required:true,
    minlength:6,
    trim:true,
    select:false




},
age:Number,
gender:{type:String,
    enum:["male","female"],
    default:"male"

},
provider:{type:String,
    enum:["system","google"],
    default:"system"
},

}


,{



    timestamps: true ,
    strict: true,
    toJSON:{virtuals:true},
})
userSchema.virtual("userName").get(function(){
    return this.firstName+" "+this.lastName
})
.set(function(value){
    const [firstName, lastName] = value.split(" ");
    this.firstName = firstName;
    this.set("lastName", lastName);
})
const userModel=mongoose.model("user",userSchema)
export default userModel