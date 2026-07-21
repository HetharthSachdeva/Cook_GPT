import { Menu, X } from "lucide-react";
import { useState } from "react";
import logo from "../assets/logo1.png";
import { navItems } from "../constants";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/clerk-react";

const Navbar = () => {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const toggleNavbar = () => {
    setMobileDrawerOpen(!mobileDrawerOpen);
  };

  return (
    <nav className="sticky top-0 z-50 py-4 backdrop-blur-lg border-b border-neutral-700/50 bg-neutral-900/80">
      <div className="container px-4 mx-auto relative lg:text-sm">
        <div className="flex justify-between items-center">
          <div className="flex items-center flex-shrink-0">
            <img className="h-10 w-10 mr-2 rounded-full" src={logo} alt="Logo" />
            <span className="text-xl text-white tracking-tight">CookGPT</span>
          </div>

          <ul className="hidden lg:flex ml-14 space-x-12">
            {navItems.map((item, index) => (
              <li key={index} className="relative">
                <a
                  href={item.href}
                  className="text-neutral-300 hover:text-white transition-colors relative before:content-[''] before:absolute before:bottom-0 before:left-0 before:w-0 before:h-[2px] before:bg-blue-500 before:transition-all before:duration-300 hover:before:w-full"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>

          {/* Desktop Buttons */}
          <div className="hidden lg:flex justify-center space-x-6 items-center">
           
          <header >
                {/* //  <button className=> */}
                     <SignedOut>
                       <SignInButton />
                     </SignedOut>
                     <SignedIn>
                       <UserButton />
                     </SignedIn>
                      {/* </button> */}
                   </header>
           
            <SignedOut>
              <SignUpButton>
                <button className="relative overflow-hidden bg-gradient-to-r from-blue-500 to-purple-600 text-white py-2 px-4 rounded-lg font-medium transition-transform hover:scale-105 ripple">
                  Create an account
                </button>
              </SignUpButton>
            </SignedOut>
          </div>

          {/* Mobile Menu */}
          <div className="lg:hidden md:flex flex-col justify-end">
            <button onClick={toggleNavbar} className="text-white">
              {mobileDrawerOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileDrawerOpen && (
          <div className="fixed right-0 z-20 bg-neutral-900 w-full p-12 flex flex-col justify-center items-center lg:hidden">
            <ul>
              {navItems.map((item, index) => (
                <li key={index} className="py-4">
                  <a href={item.href} className="text-neutral-300 hover:text-white">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
            <div className="flex space-x-6 mt-4">
              {/* <button className="relative overflow-hidden py-2 px-4 border border-neutral-700 rounded-lg text-neutral-300 hover:bg-neutral-800 transition-colors ripple"> */}
              <header >
                {/* //  <button className=> */}
                     <SignedOut>
                       <SignInButton />
                     </SignedOut>
                     <SignedIn>
                       <UserButton />
                     </SignedIn>
                      {/* </button> */}
                   </header>
              {/* </button> */}
              <SignedOut>
                <SignUpButton>
                  <button className="relative overflow-hidden py-2 px-4 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:scale-105 transition-transform ripple">
                    Create an account
                  </button>
                </SignUpButton>
              </SignedOut>
            </div>
          </div>
        )}
      </div>

      {/* Ripple Effect CSS */}
      <style>
        {`
          .ripple {
            position: relative;
            overflow: hidden;
          }

          .ripple::after {
            content: "";
            position: absolute;
            top: 50%;
            left: 50%;
            width: 0;
            height: 0;
            background: rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            transform: translate(-50%, -50%);
            opacity: 0;
            transition: width 0.4s ease-out, height 0.4s ease-out, opacity 0.4s ease-out;
          }

          .ripple:active::after {
            width: 200px;
            height: 200px;
            opacity: 1;
            transition: 0s;
          }
        `}
      </style>
    </nav>
  );
};

export default Navbar;
