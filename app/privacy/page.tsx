import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-[#121212] text-gray-300 font-sans">
      <div className="max-w-4xl mx-auto px-6 py-12 md:py-20">
        <Link href="/" className="inline-flex items-center text-[#6C63FF] hover:text-[#5b54d6] mb-8 transition-colors">
          <ArrowLeft size={20} className="mr-2" />
          Back to Chat
        </Link>
        
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-8 tracking-tight">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-12">Last Updated: March 2, 2026</p>

        <div className="space-y-12">
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">1. Introduction</h2>
            <p className="leading-relaxed">
              Welcome to CatChat (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;). We are committed to protecting your privacy and ensuring you have a safe, anonymous experience while using our platform. This Privacy Policy explains how we collect, use, and safeguard your information when you use our website and services.
            </p>
            <p className="leading-relaxed mt-4">
              By accessing or using CatChat, you agree to the terms of this Privacy Policy. If you do not agree with the terms of this policy, please do not access the service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">2. Information We Collect</h2>
            <p className="mb-4">We collect minimal information necessary to operate the service securely and effectively:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Technical Data:</strong> We automatically collect certain information when you visit, use, or navigate the service. This information does not reveal your specific identity (like your name or contact information) but may include device and usage information, such as your IP address, browser and device characteristics, operating system, language preferences, referring URLs, device name, country, location, information about how and when you use our service, and other technical information.</li>
              <li><strong>Authentication Data:</strong> If you choose to sign in, we collect your email address or social login provider information via Supabase solely for authentication purposes.</li>
              <li><strong>User-Generated Content:</strong> We process the text, audio, video, and images you transmit during a chat session. However, as detailed below, this content is ephemeral and not permanently stored.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">3. How We Use Information</h2>
            <p className="mb-4">We use the information we collect or receive:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>To facilitate account creation and logon process.</li>
              <li>To deliver the chat, voice, and video services to you.</li>
              <li>To maintain the safety and security of our platform (e.g., abuse prevention, spam detection).</li>
              <li>To improve user experience and analyze usage trends.</li>
              <li>To respond to legal requests and prevent harm.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">4. Anonymous Chat & Ephemeral Content</h2>
            <p className="leading-relaxed">
              CatChat is designed as an ephemeral communication platform. This means:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li><strong>No Permanent History:</strong> We do not store a permanent history of your text chats, voice calls, or video calls. Once a chat session ends, the message history is deleted from our client-side interface and is not retained in a persistent database.</li>
              <li><strong>Temporary Image Storage:</strong> Images uploaded during a chat are stored temporarily in Supabase Storage to facilitate delivery. These files are automatically deleted when the chat session ends or when you leave the platform. We employ automated cleanup processes to ensure no residual files remain.</li>
              <li><strong>Anonymity:</strong> While you may be signed in, your identity is not revealed to the stranger you are chatting with unless you voluntarily disclose it.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">5. Voice & Video Communication (WebRTC)</h2>
            <p className="leading-relaxed">
              Our voice and video chat features utilize WebRTC (Web Real-Time Communication) technology. This technology allows for peer-to-peer connections, meaning audio and video streams are transmitted directly between your device and your partner&apos;s device.
            </p>
            <p className="leading-relaxed mt-4">
              <strong>Important Note on IP Addresses:</strong> To establish a peer-to-peer connection, your IP address is shared with the other user&apos;s device. This is a fundamental requirement of WebRTC technology. If you wish to hide your IP address, we recommend using a VPN.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">6. Cookies and Tracking</h2>
            <p className="leading-relaxed">
              We may use cookies and similar tracking technologies (like web beacons and pixels) to access or store information. Specifically, we use cookies to manage your authentication session if you are logged in. You can refuse to accept browser cookies by activating the appropriate setting on your browser, but this may affect the functionality of the service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">7. Data Retention</h2>
            <p className="leading-relaxed">
              We retain your personal information only for as long as is necessary for the purposes set out in this privacy policy. 
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li><strong>Account Data:</strong> Retained as long as your account is active. You may request deletion at any time.</li>
              <li><strong>Chat Content:</strong> Not retained. Deleted immediately upon session termination.</li>
              <li><strong>Logs:</strong> Server logs containing technical data are retained for a limited period for security and debugging purposes, then deleted.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">8. Security Measures</h2>
            <p className="leading-relaxed">
              We have implemented appropriate technical and organizational security measures designed to protect the security of any personal information we process. However, please also remember that we cannot guarantee that the internet itself is 100% secure. Although we will do our best to protect your personal information, transmission of personal information to and from our service is at your own risk. You should only access the services within a secure environment.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">9. Third-Party Services</h2>
            <p className="mb-4">We utilize trusted third-party service providers to operate CatChat:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Supabase:</strong> Used for authentication, real-time database signaling, and temporary file storage. <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-[#6C63FF] hover:underline">Supabase Privacy Policy</a>.</li>
              <li><strong>Vercel:</strong> Used for hosting the application and serverless functions. <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-[#6C63FF] hover:underline">Vercel Privacy Policy</a>.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">10. User Rights</h2>
            <p className="leading-relaxed">
              Depending on your location (e.g., EEA, UK, California), you may have certain rights regarding your personal information, including:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li>The right to request access and obtain a copy of your personal information.</li>
              <li>The right to request rectification or erasure.</li>
              <li>The right to restrict the processing of your personal information.</li>
              <li>The right to data portability.</li>
            </ul>
            <p className="mt-4">
              To exercise these rights, please contact us using the information provided below.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">11. Children&apos;s Privacy</h2>
            <p className="leading-relaxed">
              CatChat is strictly for users aged 18 and over. We do not knowingly solicit data from or market to children under 18 years of age. By using the service, you represent that you are at least 18. If we learn that personal information from users less than 18 years of age has been collected, we will deactivate the account and take reasonable measures to promptly delete such data from our records.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">12. Changes to This Policy</h2>
            <p className="leading-relaxed">
              We may update this privacy policy from time to time. The updated version will be indicated by an updated &quot;Revised&quot; date and the updated version will be effective as soon as it is accessible. We encourage you to review this privacy policy frequently to be informed of how we are protecting your information.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">13. Contact Information</h2>
            <p className="leading-relaxed">
              If you have questions or comments about this policy, or wish to report abuse, you may contact us at:
            </p>
            <p className="mt-4 text-[#6C63FF] font-medium">
              support@catchat.com
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
