import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { defaultThemeData } from '../../../data/defaultThemeData';

const Modern = ({ previewData }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Merge provided data with default data
  const data = {
    ...defaultThemeData,
    ...previewData,
  };
  
  // Destructure data with defaults
  const {
    general = {},
    hero = {},
    about = {},
    creations = {},
    uniqueStyle = {},
    footer = {},
  } = data;

  const currentLocation = location.pathname + "reservation";

  // Convert hex color to Tailwind color class
  const getColorClass = (hexColor) => {
    // You can expand this mapping as needed
    const colorMap = {
      '#4CAF50': 'green',
      '#2196F3': 'blue',
      '#F44336': 'red',
      '#FFC107': 'yellow',
      // Add more mappings as needed
    };
    
    return colorMap[hexColor] || 'green'; // Default to green if no match
  };

  const colorClass = getColorClass(general.color);

  // State for video dialog
  const [isVideoOpen, setIsVideoOpen] = useState(false);

  return (
    <div className="font-sans bg-gray-50">
      <Helmet>
        <title>{previewData?.seo?.title || "Modern Theme"}</title>
        <meta name="description" content={previewData?.seo?.description || ""} />
        <meta name="keywords" content={previewData?.seo?.keywords || ""} />
        <meta property="og:title" content={previewData?.seo?.title || ""} />
        <meta property="og:description" content={previewData?.seo?.description || ""} />
        <meta property="og:image" content={previewData?.seo?.ogImage || ""} />
      </Helmet>

      {/* Hero Section */}
      <header className={`bg-${colorClass}-100 py-16 text-center relative`}>
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-4 animate-fade-in">
            {hero.title || "Default Hero Title"}
          </h1>
          <p className="text-lg text-gray-700 mb-8 animate-fade-in delay-200">
            {hero.subtitle}
          </p>

          <div className="relative w-full max-w-xl mx-auto group">
            <img
              src={hero?.imageUrl || "/default-image.jpg"} // Fallback image
              alt="Hero Video Thumbnail"
              className="rounded-md shadow-lg transform group-hover:scale-105 transition-transform duration-300"
            />
            <button
              onClick={() => setIsVideoOpen(true)} // Open video dialog
              className="absolute inset-0 flex items-center justify-center"
              aria-label="Play Video"
            >
              <motion.div
                className={`bg-${colorClass}-500 w-16 h-16 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 hover:shadow-2xl transition duration-300`}
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="white"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  className="w-8 h-8"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14.752 11.168l-5.197-3.01A1 1 0 008 9.045v5.91a1 1 0 001.555.832l5.197-3.01a1 1 0 000-1.664z"
                  />
                </svg>
              </motion.div>
            </button>
          </div>

          <button
            onClick={() => navigate(currentLocation)}
            style={{
              backgroundColor: general.color || '#4CAF50',
              color: 'white'
            }}
            className="mt-6 py-3 px-6 rounded-lg transition duration-300 shadow-md hover:shadow-lg"
          >
            {general?.actionButtonText || "Default Button Text"}
          </button>
        </div>
      </header>

      {/* Video Dialog */}
      <AnimatePresence>
        {isVideoOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
            onClick={() => setIsVideoOpen(false)} // Close dialog on outside click
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              className="bg-white rounded-lg overflow-hidden w-full max-w-4xl relative"
              onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside the dialog
            >
              {/* Close Button */}
              <button
                onClick={() => setIsVideoOpen(false)}
                className="absolute top-4 right-4 bg-white rounded-full p-2 hover:bg-gray-100 transition"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="w-6 h-6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>

              {/* Video Player */}
              <video
                controls
                autoPlay
                className="w-full"
                src={hero.videoUrl || "https://www.youtube.com/watch?v=dQw4w9WgXcQ"} // Fallback video URL
              >
                Your browser does not support the video tag.
              </video>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* About Section */}
      {(about.title || about.subtitle || about.imageUrl) && (
        <section className={`py-16 px-6`}>
          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8 items-center">
            {about.imageUrl && (
              <img
                src={about.imageUrl}
                alt="Hairdresser at work"
                className="rounded-lg hover:scale-105 transition duration-300"
              />
            )}
            <div>
              {about.title && (
                <h2
                  className={`text-3xl font-bold mb-4 hover:text-${colorClass}-400 transition duration-300`}
                >
                  {about.title}
                </h2>
              )}
              {about.subtitle && <p className="text-gray-700">{about.subtitle}</p>}
              {general.actionButtonText && (
                <button
                  onClick={() => navigate(currentLocation)}
                  style={{
                    backgroundColor: general.color || '#4CAF50',
                    color: 'white'
                  }}
                  className="mt-6 py-3 px-6 rounded-lg transition duration-300 shadow-md hover:shadow-lg"
                >
                  {general.actionButtonText}
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {(creations.title || creations.subtitle || creations.images) && (
        <section className={`bg-${colorClass}-100 py-16 px-6`}>
          <div className="max-w-5xl mx-auto text-center">
            {creations.title && (
              <h2 className={`text-3xl font-bold mb-6 hover:text-${colorClass}-400 transition duration-300`}>
                {creations.title}
              </h2>
            )}
            {creations.subtitle && <p className="text-gray-700 mb-10">{creations.subtitle}</p>}
            {creations.images && (
              <div className="grid md:grid-cols-3 gap-6">
                {creations.images.map(
                  (image, index) =>
                    image && (
                      <img
                        key={index}
                        src={image}
                        alt={`Work example ${index + 1}`}
                        className="rounded-lg hover:scale-105 transition duration-300"
                      />
                    )
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {(uniqueStyle.title || uniqueStyle.subtitle || uniqueStyle.imageUrl) && (
        <section className={`py-16 px-6`}>
          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8 items-center">
            <div>
              {uniqueStyle.title && (
                <h2 className={`text-3xl font-bold mb-4 hover:text-${colorClass}-400 transition duration-300`}>
                  {uniqueStyle.title}
                </h2>
              )}
              {uniqueStyle.subtitle && <p className="text-gray-700">{uniqueStyle.subtitle}</p>}
              {general.actionButtonText && (
                <button
                  onClick={() => { navigate(currentLocation) }}
                  style={{
                    backgroundColor: general.color || '#4CAF50',
                    color: 'white'
                  }}
                  className="mt-6 py-3 px-6 rounded-lg transition duration-300 shadow-md hover:shadow-lg"
                >
                  {general.actionButtonText}
                </button>
              )}
            </div>
            {uniqueStyle.imageUrl && (
              <img
                src={uniqueStyle.imageUrl}
                alt="Unique style"
                className="rounded-lg hover:scale-105 transition duration-300"
              />
            )}
          </div>
        </section>
      )}
      {/* (Optional) Services and Testimonials Sections can be added here if needed */}

      {/* Footer */}
      <footer className="bg-black text-white py-4 text-center">
        <p>{footer.copyright}</p>
      </footer>
    </div>
  );
};

export default Modern;
