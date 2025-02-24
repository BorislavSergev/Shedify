import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaBars, FaTimes } from 'react-icons/fa';
import supabase from '../hooks/supabase';
import { useLanguage } from '../contexts/LanguageContext';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const navigate = useNavigate();
  const { translate } = useLanguage();

  // Check auth status on component mount
  React.useEffect(() => {
    checkUser();
    // Subscribe to auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setIsLoggedIn(!!session);
    });

    return () => {
      if (authListener) authListener.subscription.unsubscribe();
    };
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setIsLoggedIn(!!session);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('selectedBusiness');
    localStorage.removeItem('currentPlan');
    navigate('/');
  };

  return (
    <nav className="fixed top-0 left-0 w-full bg-white shadow-md z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center">
            <Link to="/" className="text-2xl font-bold text-[#1cd05e]">
              Shedify
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4">
            {!isLoggedIn ? (
              <>
                <Link
                  to="/login"
                  className="text-gray-600 hover:text-[#1cd05e] px-3 py-2 rounded-md text-sm font-medium"
                >
                  {translate("login")}
                </Link>
                <Link
                  to="/register"
                  className="bg-[#1cd05e] text-white hover:bg-[#19b853] px-4 py-2 rounded-md text-sm font-medium"
                >
                  {translate("register")}
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/dashboard"
                  className="text-gray-600 hover:text-[#1cd05e] px-3 py-2 rounded-md text-sm font-medium"
                >
                  {translate("dashboard")}
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-gray-600 hover:text-[#1cd05e] px-3 py-2 rounded-md text-sm font-medium"
                >
                  {translate("signOut")}
                </button>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-[#1cd05e] hover:bg-gray-100 focus:outline-none"
            >
              {isOpen ? <FaTimes size={24} /> : <FaBars size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div className={`${isOpen ? 'block' : 'hidden'} md:hidden bg-white`}>
        <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
          {!isLoggedIn ? (
            <>
              <Link
                to="/login"
                className="block px-3 py-2 rounded-md text-base font-medium text-gray-600 hover:text-[#1cd05e] hover:bg-gray-100"
                onClick={() => setIsOpen(false)}
              >
                {translate("login")}
              </Link>
              <Link
                to="/register"
                className="block px-3 py-2 rounded-md text-base font-medium text-gray-600 hover:text-[#1cd05e] hover:bg-gray-100"
                onClick={() => setIsOpen(false)}
              >
                {translate("register")}
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/dashboard"
                className="block px-3 py-2 rounded-md text-base font-medium text-gray-600 hover:text-[#1cd05e] hover:bg-gray-100"
                onClick={() => setIsOpen(false)}
              >
                {translate("dashboard")}
              </Link>
              <button
                onClick={() => {
                  handleLogout();
                  setIsOpen(false);
                }}
                className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-600 hover:text-[#1cd05e] hover:bg-gray-100"
              >
                {translate("logout")}
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar; 