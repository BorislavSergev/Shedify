import React, { useState, useEffect } from 'react';
import supabase from '../hooks/supabase'; // Assuming you have Supabase setup correctly
import { useLanguage } from '../contexts/LanguageContext';

const Services = () => {
  const { translate } = useLanguage();
  const [services, setServices] = useState([]);
  const [newService, setNewService] = useState({
    name: '',
    description: '',
    price: '',
    timetomake: '', // Time to make in minutes (stored as minutes in database)
    team_id: '', // This will be automatically fetched
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentService, setCurrentService] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState(null); // For the service to delete
  const [teamId, setTeamId] = useState(null);
  const [serviceLimitPerMember, setServiceLimitPerMember] = useState(null);
  const [userServicesCount, setUserServicesCount] = useState(0);
  const [isServiceLimitReached, setIsServiceLimitReached] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [servicesPerPage] = useState(6); // Show 6 services per page

  const [lang] = useState('en'); // or get from context/redux/etc

  useEffect(() => {
    fetchServices();
    fetchTeamId();
    fetchTeamIdAndPlan();

  }, []);

  const fetchTeamIdAndPlan = async () => {
    setLoadingAction(true);
    const selectedBusiness = JSON.parse(localStorage.getItem('selectedBusiness'));
    if (!selectedBusiness?.id) return;

    try {
      // Fetch team ID and plan data
      const { data: BusinessPlan, error: BusinessPlanErr } = await supabase
        .from('Business')
        .select('planId')
        .eq('id', selectedBusiness.id)
        .single();

      if (BusinessPlanErr) throw BusinessPlanErr;

      const { data: { user } } = await supabase.auth.getUser();

      const { data: planData, error: planError } = await supabase
        .from('Plans')
        .select('max_services')
        .eq('id', BusinessPlan.planId)
        .single();

      if (planError) throw planError;

      const { data: businessTeam, error: businessTeamError } = await supabase
        .from('BusinessTeam')
        .select('id')
        .eq('businessId', selectedBusiness.id)
        .eq('userId', user.id)
        .single();

      if (businessTeamError) throw businessTeamError;

      const { data: currentSize, error: currentSizeError } = await supabase
        .from('Services')
        .select('id')
        .eq('team_id', businessTeam.id);

      if (currentSizeError) throw currentSizeError;

      setUserServicesCount(currentSize.length);
      setServiceLimitPerMember(planData.max_services);
      setIsServiceLimitReached(planData.max_services !== -1 && currentSize.length >= planData.max_services);
      
    } catch (err) {
      console.error('Error fetching team or plan:', err);
      setError('Failed to fetch team/plan details');
    } finally {
      setLoadingAction(false);
    }
  };

  const fetchTeamId = async () => {
    const selectedBusiness = JSON.parse(localStorage.getItem('selectedBusiness'));
    if (!selectedBusiness?.id) return;

    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      // Get team ID for current business and user
      const { data: businessTeam, error: teamError } = await supabase
        .from('BusinessTeam')
        .select('id')
        .eq('businessId', selectedBusiness.id)
        .eq('userId', user.id)
        .single();

      if (teamError) throw teamError;

      setTeamId(businessTeam.id);
      setNewService(prev => ({
        ...prev,
        team_id: businessTeam.id
      }));
    } catch (err) {
      console.error('Error fetching team_id:', err);
      setError('Failed to fetch team_id');
    }
  };

  const fetchServices = async () => {
    if (!teamId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('Services')
        .select('*')
        .eq('team_id', teamId);

      if (error) throw error;
      setServices(data);
    } catch (err) {
      console.error('Error fetching services:', err);
      setError('Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  // Update useEffect to handle dependencies properly
  useEffect(() => {
    fetchTeamId();
  }, []); // Fetch team ID on component mount

  useEffect(() => {
    if (teamId) {
      fetchServices();
    }
  }, [teamId]); // Fetch services when teamId changes

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;

    // Handle price formatting (ensure only two decimals)
    if (name === 'price') {
      const formattedPrice = parseFloat(value).toFixed(2); // Ensures two decimal places
      setNewService((prevState) => ({
        ...prevState,
        [name]: formattedPrice,
      }));
    } else {
      setNewService((prevState) => ({
        ...prevState,
        [name]: value,
      }));
    }
  };

  // Handle form for editing service
  const handleEditInputChange = (e) => {
    const { name, value } = e.target;

    // Handle price formatting (ensure only two decimals)
    if (name === 'price') {
      const formattedPrice = parseFloat(value).toFixed(2); // Ensures two decimal places
      setCurrentService((prevState) => ({
        ...prevState,
        [name]: formattedPrice,
      }));
    } else {
      setCurrentService((prevState) => ({
        ...prevState,
        [name]: value,
      }));
    }
  };

  // Create a new service and insert into the database
  const createService = async () => {
    if (!newService.name || !newService.description || !newService.price || !newService.timetomake || !newService.team_id) {
      setError('All fields are required');
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase.from('Services').insert([newService]);

      if (error) {
        throw new Error(error.message);
      }

      // After inserting the new service, fetch the updated list of services
      fetchServices(); // Reload the list of services

      // Clear the form
      setNewService({
        name: '',
        description: '',
        price: '',
        timetomake: '',
        team_id: '', // Clear team_id
      });
      setError('');
      setShowModal(false); // Close the modal after creation
    } catch (err) {
      console.error('Error creating service:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Edit an existing service
  const editService = async () => {
    if (!currentService.name || !currentService.description || !currentService.price || !currentService.timetomake || !currentService.team_id) {
      setError('All fields are required');
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('Services')
        .update(currentService)
        .eq('id', currentService.id);

      if (error) {
        throw new Error(error.message);
      }

      // After editing, fetch the updated list of services
      fetchServices();

      setCurrentService(null); // Clear the current service state
      setError('');
      setShowEditModal(false); // Close the edit modal
    } catch (err) {
      console.error('Error updating service:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete a service
  const deleteService = async (id) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('Services').delete().eq('id', id);

      if (error) {
        throw new Error(error.message);
      }

      // After deleting, fetch the updated list of services
      fetchServices();
      setShowDeleteModal(false); // Close the delete confirmation modal
    } catch (err) {
      console.error('Error deleting service:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const indexOfLastService = currentPage * servicesPerPage;
  const indexOfFirstService = indexOfLastService - servicesPerPage;
  const currentServices = services.slice(indexOfFirstService, indexOfLastService);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  return (
    <div className="container mx-auto p-6 bg-primary min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-4xl font-bold text-accent">{translate('services')}</h1>
          <div className="mt-2 text-gray-600">
            <span className="font-semibold">{userServicesCount}</span>
            <span className="mx-1">/</span>
            <span className="font-semibold">
              {serviceLimitPerMember === -1 ? '∞' : serviceLimitPerMember}
            </span>
            <span className="ml-1">{translate('servicesUsed')}</span>
          </div>
        </div>

        <button
          onClick={() => {
            if (isServiceLimitReached) {
              window.location.href = "/dashboard/subscription";
            } else {
              setShowModal(true);
            }
          }}
          disabled={loadingAction}
          className={`px-5 py-3 ${
            isServiceLimitReached || loadingAction 
              ? "bg-gray-400 cursor-not-allowed text-white" 
              : "bg-accent text-white hover:bg-accentHover"
          } font-semibold rounded-lg shadow-lg transition-all duration-300 flex items-center gap-2`}
        >
          {loadingAction ? (
            <>
              <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {translate('loading')}
            </> 
          ) : isServiceLimitReached ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
              </svg>
              {translate('upgradeToAddMoreServices')}
            </> 
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              {translate('addService')}
            </>
          )}
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md mb-6 flex items-center">
          <svg className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {/* Display Services */}
      <div className="mt-8 grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
          </div>
        ) : currentServices.length > 0 ? (
          currentServices.map((service) => (
            <div key={service.id} className="bg-white p-6 rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow duration-300">
              <h3 className="text-xl font-semibold text-gray-800 mb-3">{service.name}</h3>
              <p className="text-gray-600 mb-4">{service.description}</p>
              <div className="space-y-2">
                <div className="flex items-center text-gray-500">
                  <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                {parseFloat(service.price).toFixed(2)} лв.
                </div>
                <div className="flex items-center text-gray-500">
                  <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {service.timetomake} {translate('minutes')}
                </div>
              </div>
              <div className="mt-6 flex justify-between gap-4">
                <button
                  onClick={() => {
                    setCurrentService(service);
                    setShowEditModal(true);
                  }}
                  className="flex-1 bg-accent text-white p-3 rounded-lg hover:bg-accentHover transition-all duration-300 flex items-center justify-center gap-2"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  {translate('edit')}
                </button>
                <button
                  onClick={() => {
                    setServiceToDelete(service.id);
                    setShowDeleteModal(true);
                  }}
                  className="flex-1 bg-red-500 text-white p-3 rounded-lg hover:bg-red-600 transition-all duration-300 flex items-center justify-center gap-2"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  {translate('delete')}
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="mt-4 text-gray-500 text-lg">{translate('noServices')}</p>
            <p className="text-gray-400">{translate('clickAddNewService')}</p>
          </div>
        )}
      </div>

      {/* Add Pagination */}
      {services.length > servicesPerPage && (
        <div className="flex justify-center my-6 pb-6">
          {Array.from({ length: Math.ceil(services.length / servicesPerPage) }, (_, index) => (
            <button
              key={index + 1}
              onClick={() => paginate(index + 1)}
              className={`mx-1 px-4 py-2 rounded-lg ${
                currentPage === index + 1 
                  ? 'bg-accent text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors duration-200'
              }`}
            >
              {index + 1}
            </button>
          ))}
        </div>
      )}

      {/* Create Service Modal */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-gray-600 bg-opacity-50">
          <div className="bg-white p-8 rounded-lg shadow-lg w-96">
            <h2 className="text-2xl font-semibold mb-6 text-gray-800">{translate('createNewService')}</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createService();
              }}
            >
              <div className="mb-4">
                <label className="block text-gray-700">{translate('serviceName')}</label>
                <input
                  type="text"
                  name="name"
                  value={newService.name}
                  onChange={handleInputChange}
                  placeholder={translate('serviceName')}
                  className="w-full p-3 border border-gray-300 rounded-lg mt-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-gray-700">{translate('serviceDescription')}</label>
                <textarea
                  name="description"
                  value={newService.description}
                  onChange={handleInputChange}
                  placeholder={translate('serviceDescription')}
                  className="w-full p-3 border border-gray-300 rounded-lg mt-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-gray-700">{translate('price')}</label>
                <input
                  type="number"
                  name="price"
                  value={newService.price}
                  onChange={handleInputChange}
                  placeholder={translate('price')}
                  className="w-full p-3 border border-gray-300 rounded-lg mt-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  step="0.01"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-gray-700">{translate('timeInMinutes')}</label>
                <input
                  type="number"
                  name="timetomake"
                  value={newService.timetomake}
                  onChange={handleInputChange}
                  placeholder={translate('timeInMinutes')}
                  className="w-full p-3 border border-gray-300 rounded-lg mt-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="flex justify-between items-center">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-accent text-white p-3 rounded-lg mt-4 disabled:bg-green-300 hover:bg-accentHover transition-all duration-300"
                >
                  {loading ? translate('saving') : translate('save')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="ml-4 text-gray-500 hover:text-gray-700"
                >
                  {translate('cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-gray-600 bg-opacity-50">
          <div className="bg-white p-8 rounded-lg shadow-lg w-96">
            <h2 className="text-xl font-semibold mb-6 text-gray-800">{translate('confirmDeleteService')}</h2>
            <div className="flex justify-between">
              <button
                onClick={() => deleteService(serviceToDelete)}
                className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-all duration-300"
              >
                {translate('delete')}
              </button>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600 transition-all duration-300"
              >
                {translate('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Service Modal */}
      {showEditModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-gray-600 bg-opacity-50">
          <div className="bg-white p-8 rounded-lg shadow-lg w-96">
            <h2 className="text-2xl font-semibold mb-6 text-gray-800">{translate('editService')}</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                editService();
              }}
            >
              <div className="mb-4">
                <label className="block text-gray-700">{translate('serviceName')}</label>
                <input
                  type="text"
                  name="name"
                  value={currentService?.name}
                  onChange={handleEditInputChange}
                  placeholder={translate('serviceName')}
                  className="w-full p-3 border border-gray-300 rounded-lg mt-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-gray-700">{translate('serviceDescription')}</label>
                <textarea
                  name="description"
                  value={currentService?.description}
                  onChange={handleEditInputChange}
                  placeholder={translate('serviceDescription')}
                  className="w-full p-3 border border-gray-300 rounded-lg mt-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-gray-700">{translate('price')}</label>
                <input
                  type="number"
                  name="price"
                  value={currentService?.price}
                  onChange={handleEditInputChange}
                  placeholder={translate('price')}
                  className="w-full p-3 border border-gray-300 rounded-lg mt-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  step="0.01"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-gray-700">{translate('timeInMinutes')}</label>
                <input
                  type="number"
                  name="timetomake"
                  value={currentService?.timetomake}
                  onChange={handleEditInputChange}
                  placeholder={translate('timeInMinutes')}
                  className="w-full p-3 border border-gray-300 rounded-lg mt-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="flex justify-between items-center">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-accent text-white p-3 rounded-lg mt-4 disabled:bg-green-300 hover:bg-accentHover transition-all duration-300"
                >
                  {loading ? translate('saving') : translate('save')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="ml-4 text-gray-500 hover:text-gray-700"
                >
                  {translate('cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Services;
