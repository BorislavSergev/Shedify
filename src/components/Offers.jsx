import React, { useState, useEffect, useMemo } from 'react';
import { FaEdit, FaTrashAlt } from 'react-icons/fa'; // Import React Icons
import supabase from '../hooks/supabase';
import { useLanguage } from '../contexts/LanguageContext';

const Offers = () => {
  const { translate } = useLanguage();
  const [offers, setOffers] = useState([]);
  const [services, setServices] = useState([]);
  const [newOffer, setNewOffer] = useState({
    description: '',
    offer_type: '',
    discount_percentage: null,
    fixed_price: null,
    service_id: null,
    combined_service_id: null,
    start_time: '',
    end_time: '',
    title: '',
  });
  const [editOffer, setEditOffer] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [offerToDelete, setOfferToDelete] = useState(null);
  const [offerLimitPerMember, setOfferLimitPerMember] = useState(null);
  const [userOffersCount, setUserOffersCount] = useState(0);
  const [isOfferLimitReached, setIsOfferLimitReached] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const offersPerPage = 10;

  const selectedBusiness = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("selectedBusiness")) || {};
    } catch (error) {
      console.error("Invalid business data in local storage", error);
      return {};
    }
  }, []);

  const BusinessTeamIdTeamMember = useMemo(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('BusinessTeam')
      .select('id')
      .eq('businessId', selectedBusiness.id)
      .eq('userId', user.id)
      .single();

    return data.id;
  });

  useEffect(() => {
    fetchOffers();
    fetchServices();
    fetchOfferLimitsAndCount();
  }, []);

  // Fetch all available offers
  const fetchOffers = async () => {
    setLoading(true);
    try {
      // Get the authenticated user
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get the selected business from localStorage
      const selectedBusiness = JSON.parse(localStorage.getItem('selectedBusiness'));
      
      if (!user || !selectedBusiness) {
        throw new Error('User or business not found');
      }

      // First, get the BusinessTeam ID for the current user and business
      const { data: businessTeam, error: businessTeamError } = await supabase
        .from('BusinessTeam')
        .select('id')
        .eq('businessId', selectedBusiness.id)
        .eq('userId', user.id)
        .single();

      if (businessTeamError) throw businessTeamError;

      // Then fetch offers for this team member
      // Update the join relationship to use the correct foreign key
      const { data: offersData, error: offersError } = await supabase
        .from('Offers')
        .select(`
          *,
          service:service_id (
            name
          )
        `)
        .eq('team_member_id', businessTeam.id);

      if (offersError) throw offersError;

      // Map the data to include service names
      const offersWithServiceNames = offersData.map(offer => ({
        ...offer,
        service_name: offer.service?.name || 'Unknown Service'
      }));

      setOffers(offersWithServiceNames);
    } catch (err) {
      console.error('Error fetching offers:', err);
      setError('Failed to load offers');
    } finally {
      setLoading(false);
    }
  };

  // Fetch available services for the dropdown
  const fetchServices = async () => {
    try {
      // Get the authenticated user and selected business
      const { data: { user } } = await supabase.auth.getUser();
      const selectedBusiness = JSON.parse(localStorage.getItem('selectedBusiness'));

      if (!user || !selectedBusiness) {
        throw new Error('User or business not found');
      }

      // Get the BusinessTeam ID
      const { data: businessTeam, error: businessTeamError } = await supabase
        .from('BusinessTeam')
        .select('id')
        .eq('businessId', selectedBusiness.id)
        .eq('userId', user.id)
        .single();

      if (businessTeamError) throw businessTeamError;

      // Fetch services for this team member
      const { data, error } = await supabase
        .from('Services')
        .select('id, name')
        .eq('team_id', businessTeam.id);

      if (error) throw error;

      setServices(data);
    } catch (err) {
      console.error('Error fetching services:', err);
      setError('Failed to load services');
    }
  };

  // Fetch offer limits and count
  const fetchOfferLimitsAndCount = async () => {
    setLoadingAction(true);
    const selectedBusiness = JSON.parse(localStorage.getItem('selectedBusiness'));
    if (!selectedBusiness?.id) return;

    try {
      // Fetch plan details
      const { data: BusinessPlan, error: BusinessPlanErr } = await supabase
        .from('Business')
        .select('planId')
        .eq('id', selectedBusiness.id)
        .single();

      const { data: { user } } = await supabase.auth.getUser();

      const { data: planData, error: planError } = await supabase
        .from('Plans')
        .select('max_offers')
        .eq('id', BusinessPlan.planId)
        .single();

      // Fetch the current user's offers count
      const { data: businessTeam, error: businessTeamError } = await supabase
        .from('BusinessTeam')
        .select('id')
        .eq('businessId', selectedBusiness.id)
        .eq('userId', user.id)
        .single();

      const { data: currentOffers, error: currentOffersError } = await supabase
        .from('Offers')
        .select('id')
        .eq('team_member_id', businessTeam.id);

      setUserOffersCount(currentOffers.length);
      setOfferLimitPerMember(planData.max_offers);

      if (planData.max_offers === -1) {
        setIsOfferLimitReached(false);
      } else {
        setIsOfferLimitReached(currentOffers.length >= planData.max_offers);
      }
      setLoadingAction(false);

    } catch (err) {
      console.error('Error fetching offer limits and count:', err);
      setError('Failed to fetch offer limits and count');
    }
  };

  // Calculate the current offers to display based on pagination
  const indexOfLastOffer = currentPage * offersPerPage;
  const indexOfFirstOffer = indexOfLastOffer - offersPerPage;
  const currentOffers = offers.slice(indexOfFirstOffer, indexOfLastOffer);

  // Function to handle page change
  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  // Handle form field changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewOffer((prevState) => ({
      ...prevState,
      [name]: value === '' ? null : value,
    }));
  };

  // Add this helper function at the top of the component
  const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    // Convert the date string to local timezone and format it for datetime-local input
    const date = new Date(dateString);
    return date.toISOString().slice(0, 16); // Format: "YYYY-MM-DDThh:mm"
  };

  const formatDateForDB = (dateString) => {
    if (!dateString) return null;
    // Convert the local datetime to UTC for database storage
    const date = new Date(dateString);
    return date.toISOString();
  };

  // Create a new offer
  const createOffer = async () => {
    if (isOfferLimitReached) {
      setError('You have reached the maximum number of offers allowed. Please upgrade your plan.');
      return;
    }

    const {
      description,
      offer_type,
      discount_percentage,
      fixed_price,
      service_id,
      start_time,
      end_time,
    } = newOffer;

    const teamMemberId = await BusinessTeamIdTeamMember;

    if (!teamMemberId) {
      setError('Team member ID not found.');
      return;
    }

    if (!description || !offer_type || !start_time || !end_time || !service_id || !teamMemberId) {
      setError('All required fields must be filled');
      return;
    }

    if (offer_type === 'discount' && !discount_percentage) {
      setError('Discount percentage is required for discount offers');
      return;
    }

    if (offer_type === 'fixed' && !fixed_price) {
      setError('Fixed price is required for fixed price offers');
      return;
    }

    try {
      setLoading(true);

      const offerData = {
        ...newOffer,
        // Format the dates for database storage
        start_time: formatDateForDB(start_time),
        end_time: formatDateForDB(end_time),
        team_member_id: teamMemberId,
      };

      const { error } = await supabase.from('Offers').insert([offerData]);
      if (error) throw new Error(error.message);

      fetchOffers();
      fetchOfferLimitsAndCount(); // Refresh the offer count after creating a new offer

      setNewOffer({
        description: '',
        offer_type: '',
        discount_percentage: null,
        fixed_price: null,
        service_id: null,
        combined_service_id: null,
        start_time: '',
        end_time: '',
        title: '',
      });

      setShowForm(false);
      setError('');
    } catch (err) {
      console.error('Error creating offer:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Edit an offer
  const editExistingOffer = (offer) => {
    setEditOffer(offer);
    setNewOffer({
      ...offer,
      // Format the dates for the datetime-local input
      start_time: formatDateForInput(offer.start_time),
      end_time: formatDateForInput(offer.end_time),
    });
    setShowForm(true);
  };

  // Save the edited offer
  const saveEditedOffer = async () => {
    const { 
      description, 
      offer_type, 
      discount_percentage, 
      fixed_price, 
      service_id, 
      start_time, 
      end_time, 
      title 
    } = newOffer;

    const teamMemberId = await BusinessTeamIdTeamMember;

    if (!teamMemberId) {
      setError('Team member ID not found.');
      return;
    }

    if (!description || !offer_type || !start_time || !end_time || !service_id || !teamMemberId) {
      setError('All required fields must be filled');
      return;
    }

    if (offer_type === 'discount' && !discount_percentage) {
      setError('Discount percentage is required for discount offers');
      return;
    }

    if (offer_type === 'fixed' && !fixed_price) {
      setError('Fixed price is required for fixed price offers');
      return;
    }

    try {
      setLoading(true);

      // Create a clean object with only the fields that exist in the database
      const offerData = {
        description,
        offer_type,
        discount_percentage: offer_type === 'discount' ? discount_percentage : null,
        fixed_price: offer_type === 'fixed' ? fixed_price : null,
        service_id,
        start_time: formatDateForDB(start_time),
        end_time: formatDateForDB(end_time),
        team_member_id: teamMemberId,
        title
      };

      const { error } = await supabase
        .from('Offers')
        .update(offerData)
        .eq('id', editOffer.id);

      if (error) throw error;

      fetchOffers();

      setNewOffer({
        description: '',
        offer_type: '',
        discount_percentage: null,
        fixed_price: null,
        service_id: null,
        combined_service_id: null,
        start_time: '',
        end_time: '',
        title: '',
      });

      setEditOffer(null);
      setShowForm(false);
      setError('');
    } catch (err) {
      console.error('Error saving edited offer:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete an offer
  const deleteOffer = async (offerId) => {
    try {
      setLoading(true);
      const { error } = await supabase.from('Offers').delete().eq('id', offerId);
      if (error) throw new Error(error.message);

      fetchOffers();
      fetchOfferLimitsAndCount(); // Refresh the offer count after deletion
      setShowDeleteConfirmDialog(false);
    } catch (err) {
      console.error('Error deleting offer:', err);
      setError('Failed to delete offer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-gradient-to-b from-primary to-primary-dark min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-4xl font-bold text-accent">{translate('manageOffers')}</h2>
            {!loadingAction && (
              <p className="text-gray-600 mt-2">
                {offerLimitPerMember === -1 
                  ? `${translate('currentOffers')}: ${userOffersCount} (${translate('unlimited')})`
                  : `${translate('currentOffers')}: ${userOffersCount} / ${offerLimitPerMember}`
                }
              </p>
            )}
          </div>
          <button
            onClick={() => {
              if (isOfferLimitReached) {
                window.location.href = "/dashboard/subscription";
              } else if (services.length === 0) {
                setError(translate('addServicesFirst'));
                // Optionally, you could redirect to the services page
                // window.location.href = "/dashboard/services";
              } else {
                setShowForm(!showForm);
              }
            }}
            className={`px-6 py-3 rounded-lg shadow-lg transform transition-all duration-200 flex items-center space-x-2
              ${isOfferLimitReached || loadingAction || services.length === 0
                ? "bg-gray-400 hover:bg-gray-500" 
                : "bg-accent hover:bg-accent-dark hover:-translate-y-0.5"
              } text-white font-semibold`}
          >
            {loadingAction ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {translate('loading')}
              </span>
            ) : (
              <span>
                {isOfferLimitReached 
                  ? translate('upgradePlan') 
                  : services.length === 0 
                    ? translate('addServicesFirst') 
                    : showForm 
                      ? translate('cancel') 
                      : translate('addNewOffer')
                }
              </span>
            )}
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-100 border-l-4 border-red-500 text-red-700">
            <p className="font-medium">{translate('error')}</p>
            <p>{error}</p>
          </div>
        )}

        {/* Add/Edit Offer Form */}
        {showForm && (
          <div className="bg-white rounded-lg shadow-xl mb-8 overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
              <h3 className="text-2xl font-semibold text-gray-800">
                {editOffer ? translate('editOffer') : translate('addNewOffer')}
              </h3>
            </div>
            <div className="p-6">
              <form onSubmit={(e) => e.preventDefault()} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4 md:col-span-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{translate('title')}</label>
                    <input
                      type="text"
                      name="title"
                      value={newOffer.title}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
                      placeholder={translate('enterOfferTitle')}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{translate('description')}</label>
                    <textarea
                      name="description"
                      value={newOffer.description}
                      onChange={handleInputChange}
                      rows="3"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
                      placeholder={translate('enterOfferDescription')}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{translate('offerType')}</label>
                  <select
                    name="offer_type"
                    value={newOffer.offer_type}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
                  >
                    <option value="">{translate('selectOfferType')}</option>
                    <option value="discount">{translate('discount')}</option>
                    <option value="fixed">{translate('fixedPrice')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{translate('service')}</label>
                  <select
                    name="service_id"
                    value={newOffer.service_id}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
                  >
                    <option value="">{translate('selectService')}</option>
                    {services.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name}
                      </option>
                    ))}
                  </select>
                </div>

                {newOffer.offer_type === 'discount' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{translate('discountPercentage')}</label>
                    <input
                      type="number"
                      name="discount_percentage"
                      value={newOffer.discount_percentage || ''}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
                      placeholder={translate('enterDiscountPercentage')}
                    />
                  </div>
                )}

                {newOffer.offer_type === 'fixed' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{translate('fixedPrice')}</label>
                    <input
                      type="number"
                      name="fixed_price"
                      value={newOffer.fixed_price || ''}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
                      placeholder={translate('enterFixedPrice')}
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{translate('startTime')}</label>
                  <input
                    type="datetime-local"
                    name="start_time"
                    value={newOffer.start_time}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{translate('endTime')}</label>
                  <input
                    type="datetime-local"
                    name="end_time"
                    value={newOffer.end_time}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
                  />
                </div>

                <div className="md:col-span-2 flex justify-end space-x-4 mt-6">
                  <button
                    onClick={() => setShowForm(false)}
                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    {translate('cancel')}
                  </button>
                  <button
                    onClick={editOffer ? saveEditedOffer : createOffer}
                    className="px-6 py-2 bg-accent text-white rounded-lg hover:bg-accent-dark transition-colors"
                  >
                    {editOffer ? translate('saveChanges') : translate('createOffer')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Offers Table */}
        <div className="bg-white rounded-lg shadow-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-2xl font-semibold text-gray-800">{translate('currentOffers')}</h3>
          </div>
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-accent border-t-transparent"></div>
                <p className="mt-2 text-gray-600">{translate('loading')}</p>
              </div>
            ) : currentOffers.length === 0 ? (
              <div className="text-center py-12">
                <svg 
                  className="mx-auto h-16 w-16 text-gray-400"
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth="1.5" 
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="mt-4 text-lg font-medium text-gray-900">
                  {translate('noOffersAvailable')}
                </p>
                <p className="mt-1 text-gray-500">
                  {services.length === 0 
                    ? translate('addServicesBeforeOffers')
                    : isOfferLimitReached
                      ? translate('upgradeToAddMoreOffers')
                      : translate('createOfferToGetStarted')
                  }
                </p>
                <button
                  onClick={() => {
                    if (isOfferLimitReached) {
                      window.location.href = "/dashboard/subscription";
                    } else if (services.length === 0) {
                      window.location.href = "/dashboard/services";
                    } else {
                      setShowForm(true);
                    }
                  }}
                  className={`mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white 
                    ${isOfferLimitReached || services.length === 0
                      ? "bg-gray-400 hover:bg-gray-500"
                      : "bg-accent hover:bg-accent-dark"
                    } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent`}
                >
                  <svg 
                    className="mr-2 h-5 w-5" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    {isOfferLimitReached ? (
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth="2" 
                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    ) : services.length === 0 ? (
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth="2" 
                        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                      />
                    ) : (
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth="2" 
                        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                      />
                    )}
                  </svg>
                  {isOfferLimitReached 
                    ? translate('upgradePlan')
                    : services.length === 0
                      ? translate('goToServices')
                      : translate('createFirstOffer')
                  }
                </button>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{translate('title')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{translate('description')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{translate('offerType')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{translate('service')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{translate('duration')}</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{translate('actions')}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentOffers.map((offer) => (
                    <tr key={offer.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{offer.title}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-500">{offer.description}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                          ${offer.offer_type === 'discount' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                          {offer.offer_type === 'discount' 
                            ? `${offer.discount_percentage}% ${translate('discount')}`
                            : `${offer.fixed_price} ${translate('fixedPrice')}`
                          }
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{offer.service_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          <div>{new Date(offer.start_time).toLocaleDateString()}</div>
                          <div className="text-xs">{translate('to')}</div>
                          <div>{new Date(offer.end_time).toLocaleDateString()}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => editExistingOffer(offer)}
                          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-accent hover:bg-accent-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent mr-2"
                        >
                          <FaEdit className="mr-1" /> {translate('edit')}
                        </button>
                        <button
                          onClick={() => {
                            setOfferToDelete(offer);
                            setShowDeleteConfirmDialog(true);
                          }}
                          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        >
                          <FaTrashAlt className="mr-1" /> {translate('delete')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          <div className="flex justify-center my-6 pb-6">
            {Array.from({ length: Math.ceil(offers.length / offersPerPage) }, (_, index) => (
              <button
                key={index + 1}
                onClick={() => paginate(index + 1)}
                className={`mx-1 px-4 py-2 rounded-lg ${currentPage === index + 1 ? 'bg-accent text-white' : 'bg-gray-200 text-gray-700'}`}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        {showDeleteConfirmDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">{translate('confirmDeletion')}</h3>
              <p className="text-gray-500 mb-6">
                {translate('deleteConfirmMessage')}
              </p>
              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => setShowDeleteConfirmDialog(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  {translate('cancel')}
                </button>
                <button
                  onClick={() => deleteOffer(offerToDelete.id)}
                  className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                >
                  {translate('delete')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error messages */}
        {error && (
          <div className="fixed bottom-4 right-4 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-lg">
            <p className="font-bold">{translate('error')}</p>
            <p>{error}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Offers;