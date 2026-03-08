"use client";

import { useEffect, useRef, type MouseEvent } from "react";
import { FaGithub, FaLinkedin } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";

function StaggerCard({ index, children }: { index: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            el.style.opacity = "1";
            el.style.transform = "translateY(0)";
          }, index * 150);
          observer.unobserve(el);
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [index]);

  return (
    <div
      ref={ref}
      style={{
        opacity: 0,
        transform: "translateY(40px)",
        transition: "opacity 0.6s ease-out, transform 0.6s ease-out",
      }}
    >
      {children}
    </div>
  );
}

function TiltCard({ children }: { children: React.ReactNode }) {
  const cardRef = useRef<HTMLDivElement>(null);

  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -15;
    const rotateY = ((x - centerX) / centerX) * 15;
    card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.05, 1.05, 1.05)`;
  }

  function handleMouseLeave() {
    const card = cardRef.current;
    if (!card) return;
    card.style.transform = "perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)";
  }

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ transition: "transform 0.15s ease-out", transformStyle: "preserve-3d" }}
    >
      {children}
    </div>
  );
}

export default function AboutPage() {
  const team = [
    {
      name: "Shreehari",
      role: "Back-End Developer",
      img: "assets/images/shreehari.jpg",
      github: "https://github.com/Shreehari-Acharya",
      linkedin: "https://www.linkedin.com/in/shreehari-acharya/",
      x: "",
    },
    {
      name: "Binit Gupta",
      role: "Back-End Developer",
      img: "assets/images/binit.jpg",
      github: "https://github.com/binit2-1",
      linkedin: "https://www.linkedin.com/in/binitgupta",
      x: "https://x.com/BinitGupta21",
    },
    
    {
      name: "Gourish Mokashi",
      role: "Front-End Developer",
      img: "assets/images/gourish.jpeg",
      github: "https://github.com/gourish-mokashi",
      linkedin: "https://www.linkedin.com/in/gourish-mokashi",
      x: "https://x.com/GourishMokashi",
    },


    {
      name: "Sanjana Patil",
      role: "Front-End Developer",
      img: "assets/images/sanjana.jpg",
      github: "https://github.com/Sanjana0019",
      linkedin: "https://www.linkedin.com/in/sanjana-patil-dev",
      x: "https://x.com/sanjana_p0019",
    },
  ];

  return (
    <div className="w-full p-8">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="rounded-lg shadow-md">
          <h1 className="mb-6 text-3xl font-bold text-white md:text-5xl">
            <span className="text-white">About</span>{" "}
            <span className="text-blue-600">Watch</span>
            <span className="text-white">dog</span>
          </h1>

          <div className="mb-6 border-t-2 border-gray-500" />

          <div className="prose max-w-none text-gray-300">
            <p className="text-base leading-relaxed md:text-lg">
              Watchdog is a platform designed to monitor, analyze, and
              manage critical events and incidents in real time. It helps teams
              quickly identify high-priority situations, perform automated
              analysis, and generate structured reports for better
              decision-making and accountability.
            </p>

            <h2 className="mb-4 mt-14 text-2xl font-bold text-white md:text-4xl">
              Tech Stack
            </h2>

            <p className="text-base leading-relaxed md:text-lg">
              Frontend: Next.js, React, TypeScript, Tailwind CSS
              <br />
              Backend: Node.js / API Routes
              <br />
              Data Handling: JSON-based event storage and processing
              <br />
              Reporting: Automated PDF report generation
            </p>

            <h2 className="mb-4 mt-14 text-2xl font-bold text-white md:text-4xl">
              Our Technology
            </h2>

            <p className="text-base leading-relaxed md:text-lg">
              The platform processes incoming event data and automatically
              evaluates priority levels, categories, and impact indicators.
              Through the analysis module, users can review key insights,
              understand the severity of incidents, and identify required
              actions.
            </p>

            <p className="mt-4 text-base leading-relaxed md:text-lg">
              Once analysis is completed, the system generates a structured
              report summarizing the event details, risk level, findings, and
              recommended actions. These reports can be downloaded and used for
              documentation, auditing, and operational decision-making.
            </p>

            <h2 className="mb-4 mt-14 text-2xl font-bold text-white md:text-4xl">
              Our Team
            </h2>
          </div>

          <div className="mb-8" />

          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-4">
            {team.map((person, i) => (
              <StaggerCard key={i} index={i}>
                <TiltCard>
                <div className="flex flex-col rounded-3xl border border-gray-700 bg-[#1a1a1a] p-4 text-center shadow-md">
                  <div className="h-72 w-full overflow-hidden rounded-xl">
                    <img
                      src={person.img}
                      alt={person.name}
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <div className="mt-4">
                    <h3 className="text-lg font-semibold text-white">
                      {person.name}
                    </h3>

                    <p className="text-sm text-gray-400">{person.role}</p>

                    <div className="mt-2 flex justify-center gap-4 text-xl text-white">
                      {person.github && (
                        <a
                          href={person.github}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <FaGithub className="hover:text-pink-500" />
                        </a>
                      )}

                      {person.linkedin && (
                        <a
                          href={person.linkedin}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <FaLinkedin className="hover:text-blue-600" />
                        </a>
                      )}

                      {person.x && (
                        <a
                          href={person.x}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <FaXTwitter className="hover:text-white" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </TiltCard>
              </StaggerCard>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
