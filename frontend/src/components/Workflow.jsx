import { CheckCircle2 } from "lucide-react";
import documentImg from "../assets/doc-analyz.webp";
import { checklistItems } from "../constants";

const Workflow = () => {
  return (
    <div className="mt-20" id="workflow-section">
      <h2 className="text-3xl sm:text-5xl lg:text-6xl text-center mt-6 tracking-wide text-white mb-8">
        Accelerate your{" "}
        <span className="bg-gradient-to-r from-blue-500 to-purple-800 text-transparent bg-clip-text">
          document analysis.
        </span>
      </h2>
      <div className="flex flex-wrap justify-center">
        <div className="w-full lg:w-1/2 flex justify-center mb-8">
          <img 
            src={documentImg} 
            alt="Document Analysis" 
            className="rounded-2xl shadow-2xl border border-neutral-700 bg-neutral-800"
          />
        </div>
        <div className="pt-12 w-full lg:w-1/2">
          {checklistItems.map((item, index) => (
            <div key={index} className="flex mb-12">
              <div className="text-blue-400 mx-6 bg-neutral-900 h-10 w-10 p-2 flex justify-center items-center rounded-full">
                <CheckCircle2 />
              </div>
              <div>
                <h5 className="mt-1 mb-2 text-xl text-white">{item.title}</h5>
                <p className="text-md text-neutral-400">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Workflow;
