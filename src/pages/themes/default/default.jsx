import React from "react";
import { Helmet } from "react-helmet-async";
import { HelmetProvider } from 'react-helmet-async';
import { defaultThemeData } from '../../../data/defaultThemeData';

// Add getLighterShade function at the top
const getLighterShade = (hexColor, opacity = 0.15) => {
  if (!hexColor) return 'rgba(76, 175, 80, 0.15)';
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const Default = ({ previewData }) => {
  // Merge provided data with default data
  const data = {
    ...defaultThemeData,
    ...previewData,
  };
  
  // Destructure data properties
  const { general = {}, hero = {}, about = {}, creations = {}, uniqueStyle = {}, footer = {} } = data;

  // Convert hex color to Tailwind color class
  const getColorClass = (hexColor) => {
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

  return (
    <HelmetProvider>
      <div className="font-sans">
        <Helmet>
          <title>{previewData?.seo?.title || "Default Theme"}</title>
          <meta name="description" content={previewData?.seo?.description || ""} />
          <meta name="keywords" content={previewData?.seo?.keywords || ""} />
          <meta property="og:title" content={previewData?.seo?.title || ""} />
          <meta property="og:description" content={previewData?.seo?.description || ""} />
          <meta property="description" content={previewData?.seo?.description || ""} />
          <meta
          name={previewData?.seo?.title}
          content={previewData?.seo?.description}
          data-rh="true"
          />

          <meta property="og:image" content={previewData?.seo?.ogImage || ""} />
        </Helmet>

        {/* Header Section */}
        <header
          className={`relative h-screen bg-cover bg-center ${hero.backgroundImageUrl ? "" : "bg-gray-300"}`} // Default gray background if no image
          style={hero.backgroundImageUrl ? { backgroundImage: `url('${hero.backgroundImageUrl}')`, backgroundAttachment: "fixed" } : {}}
        >
          <div className="bg-black bg-opacity-50 w-full h-full flex flex-col items-center justify-center text-center text-white">
            {hero.title && (
              <h1 className={`text-4xl font-bold hover:text-${colorClass}-400 transition duration-300`}>
                {hero.title}
              </h1>
            )}
            {hero.subtitle && <p className="mt-4 text-lg">{hero.subtitle}</p>}
            {general.actionButtonText && (
              <button
                onClick={() => {
                  const currentUrl = window.location.href;
                  window.location.href = `${currentUrl}/reservation`;
                }}
                style={{
                  backgroundColor: general.color || '#4CAF50',
                  color: 'white'
                }}
                className="mt-6 py-3 px-6 rounded-lg transition duration-300 hover:bg-${colorClass}-600"
              >
                {general.actionButtonText || "Default Button Text"}
              </button>
            )}
          </div>
        </header>

        {/* About Section with lighter background */}
        {(about.title || about.subtitle || about.imageUrl) && (
          <section 
            style={{ 
              backgroundColor: getLighterShade(general.color) 
            }}
            className="py-16 px-6"
          >
            <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8 items-center ">
              {about.imageUrl && (
                <img
                  src={about.imageUrl}
                  alt="Hairdresser at work"
                  className="rounded-lg hover:scale-105 transition duration-300"
                />
              )}
              <div>
                {about.title && (
                  <h2 className={`text-3xl font-bold mb-4 hover:text-${colorClass}-400 transition duration-300`}>
                    {about.title}
                  </h2>
                )}
                {about.subtitle && <p className="text-gray-700">{about.subtitle}</p>}
                {general.actionButtonText && (
                  <button
                    onClick={() => {
                      const currentUrl = window.location.href;
                      window.location.href = `${currentUrl}/reservation`;
                    }}
                    style={{
                      backgroundColor: general.color || '#4CAF50',
                      color: 'white'
                    }}
                    className="mt-6 py-3 px-6 rounded-lg transition duration-300 hover:bg-${colorClass}-600"
                  >
                    {general.actionButtonText || "Default Button Text"}
                  </button>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Creations Section */}
        {(creations.title || creations.subtitle || creations.images) && (
          <section className="py-16 px-6">
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

        {/* Unique Style Section with lighter background */}
        {(uniqueStyle.title || uniqueStyle.subtitle || uniqueStyle.imageUrl) && (
          <section 
            style={{ 
              backgroundColor: getLighterShade(general.color) 
            }}
            className="py-16 px-6"
          >
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
                    onClick={() => {
                      const currentUrl = window.location.href;
                      window.location.href = `${currentUrl}/reservation`;
                    }}
                    style={{
                      backgroundColor: general.color || '#4CAF50',
                      color: 'white'
                    }}
                    className="mt-6 py-3 px-6 rounded-lg transition duration-300 hover:bg-${colorClass}-600"
                  >
                    {general.actionButtonText || "Default Button Text"}
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

        {/* Footer */}
        <footer className={`bg-black text-white py-4 text-center`}>
          <p>{footer.copyright}</p>
        </footer>
      </div>
    </HelmetProvider>
  );
};

export default Default;
