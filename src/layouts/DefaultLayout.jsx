import React from "react";
import { Outlet } from "react-router-dom";

const DefaultLayout = () => {
  return (
    <div className="min-h-screen h-full w-full flex items-center justify-center bg-gray-50">
      <main className="w-full h-full">
        <Outlet /> {/* This renders child routes */}
      </main>
    </div>
  );
};

export default DefaultLayout;
