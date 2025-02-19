import React, { useState, useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FaClock, FaCogs, FaClipboardList, FaBars, FaPaintBrush } from "react-icons/fa";
import { CiShare1 } from "react-icons/ci";
import { BiSolidOffer } from "react-icons/bi";
import { MdDashboard } from "react-icons/md";
import { BsFillPeopleFill } from "react-icons/bs";
import supabase from "../hooks/supabase";
import { useLanguage } from '../contexts/LanguageContext';

const Sidebar = () => {
  const { translate } = useLanguage();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentPlan, setCurrentPlan] = useState("Loading...");
  const [businessLink, setBusinessLink] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();

  const currentBusiness = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("selectedBusiness")) || {};
    } catch (error) {
      console.error("Invalid business data in local storage", error);
      return {};
    }
  }, []);

  // Fetch selected business and current plan
  useEffect(() => {
    const fetchPlan = async () => {
      setBusinessLink("business/" + currentBusiness.id + "/");
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError) throw authError;

        const { data: selectedBusiness, error: businessError } = await supabase
          .from("Business")
          .select("planId, Plans(plan_name)")
          .eq("id", currentBusiness.id)
          .single();

        if (businessError) throw businessError;

        if (!selectedBusiness?.planId) {
          setCurrentPlan("No Plan");
          return;
        }

        setCurrentPlan(selectedBusiness?.Plans?.plan_name || "Unknown Plan");
      } catch (error) {
        console.error("Error fetching plan:", error);
        setCurrentPlan("Error loading plan");
      }
    };

    fetchPlan();
  }, [navigate]);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const isActive = (path) => location.pathname === path;

  const handleManageSubscription = async () => {
    navigate('/dashboard/subscription');
  };

  const handleNavigation = (e, path) => {
    if (currentPlan === "No Plan" && path !== "/dashboard/subscription") {
      e.preventDefault();
      navigate('/dashboard/subscription');
    }
  };

  return (
    <>
      <aside
        className={`fixed top-0 left-0 h-full w-52 bg-white text-gray-700 shadow-2xl z-20 transform transition-transform duration-300 flex flex-col overflow-y-auto ${
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 md:relative md:shadow-md`}
      >
        <h1 className="text-3xl font-bold text-accent mb-8 text-center mt-6">Shedify</h1>
        <div className="flex-1 flex flex-col gap-6">
          <nav className="flex flex-col gap-4">
            <Link
              to="/dashboard"
              onClick={(e) => handleNavigation(e, "/dashboard")}
              className={`flex items-center text-lg py-2 px-4 rounded-md transition ${
                isActive("/dashboard") ? "bg-gray-100 text-accent" : "hover:bg-gray-100 hover:text-accent"
              }`}
            >
              <MdDashboard className="w-6 h-6 mr-3" />
              <span>{translate('dashboard')}</span>
            </Link>
            <Link
              to="/dashboard/team"
              onClick={(e) => handleNavigation(e, "/dashboard/team")}
              className={`flex items-center text-lg py-2 px-4 rounded-md transition ${
                isActive("/dashboard/team") ? "bg-gray-100 text-accent" : "hover:bg-gray-100 hover:text-accent"
              }`}
            >
              <BsFillPeopleFill className="w-5 h-5 mr-3" />
              <span>{translate('teams')}</span>
            </Link>
            <Link
              to="/dashboard/settings"
              onClick={(e) => handleNavigation(e, "/dashboard/settings")}
              className={`flex items-center text-lg py-2 px-4 rounded-md transition ${
                isActive("/dashboard/settings") ? "bg-gray-100 text-accent" : "hover:bg-gray-100 hover:text-accent"
              }`}
            >
              <FaCogs className="w-6 h-6 mr-3" />
              <span>{translate('settings')}</span>
            </Link>
            <Link
              to="/dashboard/customize"
              onClick={(e) => handleNavigation(e, "/dashboard/customize")}
              className={`flex items-center text-lg py-2 px-4 rounded-md transition ${
                isActive("/dashboard/customize") ? "bg-gray-100 text-accent" : "hover:bg-gray-100 hover:text-accent"
              }`}
            >
              <FaPaintBrush className="w-5 h-5 mr-3" />
              <span>{translate('customize')}</span>
            </Link>
            <Link
              to="/dashboard/reservations"
              onClick={(e) => handleNavigation(e, "/dashboard/reservations")}
              className={`flex items-center text-lg py-2 px-4 rounded-md transition ${
                isActive("/dashboard/reservations") ? "bg-gray-100 text-accent" : "hover:bg-gray-100 hover:text-accent"
              }`}
            >
              <FaClock className="w-5 h-5 mr-3" />
              <span>{translate('reservations')}</span>
            </Link>
            <Link
              to="/dashboard/services"
              onClick={(e) => handleNavigation(e, "/dashboard/services")}
              className={`flex items-center text-lg py-2 px-4 rounded-md transition ${
                isActive("/dashboard/services") ? "bg-gray-100 text-accent" : "hover:bg-gray-100 hover:text-accent"
              }`}
            >
              <FaClipboardList className="w-5 h-5 mr-3" />
              <span>{translate('services')}</span>
            </Link>
            <Link
              to="/dashboard/offers"
              onClick={(e) => handleNavigation(e, "/dashboard/offers")}
              className={`flex items-center text-lg py-2 px-4 rounded-md transition ${
                isActive("/dashboard/offers") ? "bg-gray-100 text-accent" : "hover:bg-gray-100 hover:text-accent"
              }`}
            >
              <BiSolidOffer className="w-5 h-5 mr-3" />
              <span>{translate('offers')}</span>
            </Link>
          </nav>
        </div>

        <Link
              to={`/${currentBusiness.id}/`}
              onClick={(e) => handleNavigation(e, "/business")}
              className={`flex items-center text-lg py-4 px-6 rounded-md transition ${
                isActive("/business") ? "bg-gray-100 text-accent" : "hover:bg-gray-100 hover:text-accent"
              }`}
            >
              <CiShare1 className="w-5 h-5 mr-3" />
              <span>{translate('viewStore')}</span>
            </Link>
        <div className="p-4 border-t border-gray-200">
          <div className="flex flex-col gap-2">
            <p className="text-sm text-gray-500">
              {translate('plan')}: <span className={currentPlan === "No Plan" ? "text-red-500 font-medium" : ""}>{currentPlan}</span>
            </p>
            <button
              className="w-full px-4 py-2 text-sm text-white bg-accent rounded-md shadow hover:bg-accentHover transition"
              onClick={handleManageSubscription}
            >
              {translate('manageSubscription')}
            </button>
          </div>
        </div>
      </aside>

      <div
        className="md:hidden fixed top-1 left-2 z-50 p-4 cursor-pointer"
        onClick={toggleMobileMenu}
      >
        <FaBars className="text-2xl text-gray-700" />
      </div>
    </>
  );
};

export default Sidebar;
