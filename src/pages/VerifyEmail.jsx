import React from "react";
import { Link } from "react-router-dom";

const VerifyEmail = () => {
  return (
    <div className="flex h-screen justify-center items-center bg-primary">
      <div className="w-full max-w-md p-8 bg-white shadow-md rounded-lg text-center">
        <h2 className="text-2xl font-bold mb-4">Please Verify Your Email</h2>
        <p className="mb-4">
          We have sent a verification email to your inbox. Please check your email to confirm your address and complete your registration.
        </p>
        <p>
          Didn't receive the email? <Link to="/login" className="text-blue-600">Try logging in</Link> again.
        </p>
      </div>
    </div>
  );
};

export default VerifyEmail;
