import React from 'react';
import { format } from 'date-fns';
import { useLanguage } from '../contexts/LanguageContext';

const ReservationCard = ({ reservation, onStatusUpdate }) => {
  const { translate } = useLanguage();

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-4">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">
            {translate('clientName')}: {reservation.firstName} {reservation.lastName}
          </h3>
          <p className="text-gray-600 mt-1">
            {translate('phoneNumber')}: {reservation.phoneNumber}
          </p>
          <p className="text-gray-600">
            {translate('email')}: {reservation.email}
          </p>
        </div>
        <div className="text-right">
          <p className="text-gray-600">
            {translate('reservationDate')}: {format(new Date(reservation.reservationAt), 'PP')}
          </p>
          <p className="text-gray-600">
            {translate('reservationTime')}: {format(new Date(reservation.reservationAt), 'p')}
          </p>
        </div>
      </div>

      <div className="border-t border-b border-gray-200 py-4 my-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-gray-600">
              {translate('duration')}: {reservation.timeToMake} {translate('minutes')}
            </p>
            <p className="text-gray-600">
              {translate('totalPrice')}: ${reservation.totalPrice}
            </p>
          </div>
          <div className="text-right">
            <p className="text-gray-600">
              {translate('assignedTo')}: {reservation.BusinessTeam?.Users?.first_name} {reservation.BusinessTeam?.Users?.last_name}
            </p>
            <p className="text-gray-600">
              {translate('status')}: <span className={`font-semibold ${
                reservation.status === 'pending' ? 'text-yellow-600' :
                reservation.status === 'approved' ? 'text-green-600' :
                'text-red-600'
              }`}>{translate(reservation.status)}</span>
            </p>
          </div>
        </div>
      </div>

      <div>
        <h4 className="font-medium text-gray-900 mb-2">{translate('services')}:</h4>
        <div className="flex flex-wrap gap-2 mb-4">
          {Array.isArray(reservation.services) && reservation.services.map((service, index) => (
            <span
              key={index}
              className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm"
            >
              {service}
            </span>
          ))}
        </div>
      </div>

      {reservation.notes && (
        <div className="mt-4">
          <h4 className="font-medium text-gray-900 mb-2">{translate('notes')}:</h4>
          <p className="text-gray-600">{reservation.notes}</p>
        </div>
      )}

      {onStatusUpdate && reservation.status === 'pending' && (
        <div className="flex gap-3 mt-6">
          <button
            onClick={() => onStatusUpdate(reservation.id, 'approved')}
            className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors"
          >
            {translate('accept')}
          </button>
          <button
            onClick={() => onStatusUpdate(reservation.id, 'cancelled')}
            className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 transition-colors"
          >
            {translate('decline')}
          </button>
        </div>
      )}
    </div>
  );
};

const AcceptedReservationCard = ({ reservation }) => {
  const { translate } = useLanguage();
  
  return (
    <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-100">
      <div>
        <h3 className="font-medium text-gray-900">
          {reservation.firstName} {reservation.lastName}
        </h3>
        <div className="text-sm text-gray-500 space-y-1 mt-1">
          <p className="flex items-center">
            <span className="mr-2">📅</span>
            {format(new Date(reservation.reservationAt), "PPp")}
          </p>
          <p className="flex items-center">
            <span className="mr-2">⏱️</span>
            {translate('duration')}: {reservation.timeToMake} {translate('minutes')}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium text-gray-900">
          {translate('assignedTo')}: {reservation.BusinessTeam?.Users?.first_name} {reservation.BusinessTeam?.Users?.last_name}
        </p>
        <p className="text-sm text-gray-500 mt-1">
          {Array.isArray(reservation.services) && reservation.services.join(", ")}
        </p>
      </div>
    </div>
  );
};

export { ReservationCard, AcceptedReservationCard };