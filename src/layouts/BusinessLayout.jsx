import React from "react";
import { Outlet } from "react-router-dom"; // Important for nested routes
import Sidebar from "./Sidebar"; // Create this or replace it with a placeholder component
import HeaderDashboard from "./HeaderDashboard";

const BusinessLayout = () => {
  return (
    <div className="h-screen flex bg-gray-100">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      
      <main className="flex-1 bg-primary overflow-y-auto">
      <HeaderDashboard/>
        <Outlet/> {/* This renders child routes */}
      </main>
    </div>
  );
};

export default BusinessLayout;
