const mongoose = require('mongoose');

const EmployeeSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    mobileNumber: { type: String, default: '', trim: true },
    designation: { type: String, default: '', trim: true },
    joiningDate: { type: Date },
    isActive: { type: Boolean, default: true, index: true },
    profileImage: { type: String, default: '', trim: true },
  },
  { timestamps: true }
);

EmployeeSchema.index({ isActive: 1, fullName: 1 });

module.exports = mongoose.model('Employee', EmployeeSchema);
