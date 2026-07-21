import { motion } from "framer-motion";
import { TypeAnimation } from "react-type-animation";
import { useClerk } from "@clerk/clerk-react"; // Import Clerk hook
import video1 from "../assets/video1.mp4";
import video2 from "../assets/video2.mp4";

const HeroSection = () => {
  const { openSignIn } = useClerk(); // Get openSignIn from Clerk

  // Handler for the Start for Free button
  const handleStartFree = () => {
    openSignIn({
      // Optional configuration
      redirectUrl: "/dashboard", // Where to redirect after successful sign-in
      appearance: {
        // Customize appearance if needed
        variables: {
          colorPrimary: "#3b82f6", // Matches your blue-500
        },
      },
    });
  };
  return (
    <div className="relative flex flex-col items-center justify-center mt-6 lg:mt-20 px-6 text-center">
      {/* Video Background */}
      <video
        autoPlay
        loop
        muted
        className="absolute top-0 left-0 w-full h-full object-cover opacity-30 -z-10"
      >
        Your browser does not support the video tag.
      </video>

      <div className="relative z-10 bg-black bg-opacity-50 p-10 rounded-lg max-w-5xl w-full">
        {/* Heading with Typing Animation */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-4xl sm:text-6xl lg:text-7xl tracking-wide text-white"
        >
          <TypeAnimation
            sequence={["Chat", 1000, "Chat with Documents", 2000]}
            speed={50}
            repeat={Infinity}
            className="bg-gradient-to-r from-blue-400 to-purple-500 text-transparent bg-clip-text"
          />
        </motion.h1>

        {/* Subtitle Animation */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.4 }}
          className="mt-6 text-lg text-neutral-300 max-w-3xl mx-auto"
        >
          AI-powered tools to summarize, extract key insights, and chat with
          your PDFs effortlessly.
        </motion.p>

        {/* Call to Action Buttons */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.6 }}
          className="flex justify-center mt-8 space-x-4"
        >
          {/* <button
            onClick={handleStartFree}
            className="bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 px-6 rounded-lg font-medium transition-transform hover:scale-105"
          >
            Start for Free
          </button> */}
          <a
            href="https://github.com/vsmay-01/Cook_GPT/blob/main/README.md"
            className="py-3 px-6 rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800 transition-colors"
          >
            Documentation
          </a>
        </motion.div>

        {/* Videos Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.8 }}
          className="flex flex-col lg:flex-row items-center justify-center mt-12 gap-6"
        >
          <motion.video
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 1 }}
            autoPlay
            loop
            muted
            className="rounded-xl w-full h-[400px] lg:w-[48%] lg:h-[400px] border border-blue-500 shadow-md shadow-blue-500/40 backdrop-blur-lg"
            >
            <source src={video1} type="video/mp4" />
            Your browser does not support the video tag.
          </motion.video>

          <motion.video
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 1.2 }}
            autoPlay
            loop
            muted
            className="rounded-xl w-full h-[400px] lg:w-[48%] lg:h-[400px] border border-blue-500 shadow-md shadow-blue-500/40"
          >
            <source src={video2} type="video/mp4" />
            Your browser does not support the video tag.
          </motion.video>

        </motion.div>
      </div>
    </div>
  );
};

export default HeroSection;
