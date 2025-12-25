<script setup lang="ts">
import iotoLogo from '../assets/ioto-logo.png'
</script>

<template>
  <div class="p-6 lg:p-8 overflow-y-auto">
    <div class="max-w-4xl mx-auto">
      <!-- Header -->
      <div class="text-center mb-10">
        <img :src="iotoLogo" alt="IoTo Communications" class="w-40 h-40 mx-auto object-contain" />
      </div>

      <!-- Mission Section -->
      <div class="bg-surface-dark border border-border-dark rounded-xl p-6 mb-6">
        <h2 class="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <span class="material-symbols-outlined text-primary">flag</span>
          Our Mission
        </h2>
        <p class="text-text-secondary leading-relaxed">
          At IoTo Communications, we are dedicated to simplifying IoT connectivity management for businesses worldwide.
          Our mission is to provide seamless, secure, and scalable solutions that empower organizations to harness
          the full potential of their connected devices.
        </p>
      </div>

      <!-- What We Do Section -->
      <div class="bg-surface-dark border border-border-dark rounded-xl p-6 mb-6">
        <h2 class="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <span class="material-symbols-outlined text-primary">devices</span>
          What We Do
        </h2>
        <div class="grid md:grid-cols-2 gap-4">
          <div class="bg-background-dark rounded-lg p-4 border border-border-dark">
            <div class="flex items-center gap-3 mb-2">
              <span class="material-symbols-outlined text-blue-400">sim_card</span>
              <h3 class="font-medium text-white">SIM Card Management</h3>
            </div>
            <p class="text-text-secondary text-sm">
              Comprehensive management of IoT SIM cards with real-time monitoring, usage tracking, and automated lifecycle management.
            </p>
          </div>
          <div class="bg-background-dark rounded-lg p-4 border border-border-dark">
            <div class="flex items-center gap-3 mb-2">
              <span class="material-symbols-outlined text-green-400">router</span>
              <h3 class="font-medium text-white">Device Monitoring</h3>
            </div>
            <p class="text-text-secondary text-sm">
              Track and manage your entire fleet of IoT devices from a single dashboard with detailed analytics and alerts.
            </p>
          </div>
          <div class="bg-background-dark rounded-lg p-4 border border-border-dark">
            <div class="flex items-center gap-3 mb-2">
              <span class="material-symbols-outlined text-amber-400">public</span>
              <h3 class="font-medium text-white">Global Connectivity</h3>
            </div>
            <p class="text-text-secondary text-sm">
              Multi-carrier support with coverage across 190+ countries, ensuring your devices stay connected wherever they operate.
            </p>
          </div>
          <div class="bg-background-dark rounded-lg p-4 border border-border-dark">
            <div class="flex items-center gap-3 mb-2">
              <span class="material-symbols-outlined text-purple-400">smart_toy</span>
              <h3 class="font-medium text-white">AI-Powered Insights</h3>
            </div>
            <p class="text-text-secondary text-sm">
              Leverage our Ask Bob AI assistant for intelligent data queries and actionable insights from your IoT ecosystem.
            </p>
          </div>
        </div>
      </div>

      <!-- Key Features Section -->
      <div class="bg-surface-dark border border-border-dark rounded-xl p-6 mb-6">
        <h2 class="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <span class="material-symbols-outlined text-primary">stars</span>
          Key Features
        </h2>
        <ul class="space-y-3">
          <li class="flex items-start gap-3">
            <span class="material-symbols-outlined text-green-400 text-lg mt-0.5">check_circle</span>
            <div>
              <span class="text-white font-medium">Real-time Device Tracking</span>
              <p class="text-text-secondary text-sm">Monitor device locations, status, and sensor data in real-time with interactive maps.</p>
            </div>
          </li>
          <li class="flex items-start gap-3">
            <span class="material-symbols-outlined text-green-400 text-lg mt-0.5">check_circle</span>
            <div>
              <span class="text-white font-medium">Environmental Monitoring</span>
              <p class="text-text-secondary text-sm">Track temperature, humidity, and light levels with historical data and trend analysis.</p>
            </div>
          </li>
          <li class="flex items-start gap-3">
            <span class="material-symbols-outlined text-green-400 text-lg mt-0.5">check_circle</span>
            <div>
              <span class="text-white font-medium">Usage Analytics</span>
              <p class="text-text-secondary text-sm">Detailed data usage reports and cost analysis for optimizing your connectivity spend.</p>
            </div>
          </li>
          <li class="flex items-start gap-3">
            <span class="material-symbols-outlined text-green-400 text-lg mt-0.5">check_circle</span>
            <div>
              <span class="text-white font-medium">Role-Based Access Control</span>
              <p class="text-text-secondary text-sm">Secure multi-user access with customizable permissions for teams of any size.</p>
            </div>
          </li>
          <li class="flex items-start gap-3">
            <span class="material-symbols-outlined text-green-400 text-lg mt-0.5">check_circle</span>
            <div>
              <span class="text-white font-medium">API Integration</span>
              <p class="text-text-secondary text-sm">RESTful APIs for seamless integration with your existing systems and workflows.</p>
            </div>
          </li>
          <li class="flex items-start gap-3">
            <span class="material-symbols-outlined text-green-400 text-lg mt-0.5">check_circle</span>
            <div>
              <span class="text-white font-medium">Expert Consultancy</span>
              <p class="text-text-secondary text-sm">Dedicated IoT consultants providing strategic guidance, deployment optimization, and ongoing support tailored to your business needs.</p>
            </div>
          </li>
        </ul>
      </div>

      <!-- E2E Support & Vision Section -->
      <div class="bg-surface-dark border border-border-dark rounded-xl p-6 mb-6">
        <h2 class="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <span class="material-symbols-outlined text-primary">support_agent</span>
          End-to-End Support & Our Vision
        </h2>
        <div class="space-y-4">
          <div class="bg-background-dark rounded-lg p-4 border border-border-dark">
            <h3 class="font-medium text-white mb-2 flex items-center gap-2">
              <span class="material-symbols-outlined text-amber-400 text-lg">handshake</span>
              Complete E2E Support
            </h3>
            <p class="text-text-secondary text-sm leading-relaxed">
              At IoTo Communications, we believe in being more than just a service provider - we are your trusted partner throughout your entire IoT journey.
              From initial consultation and solution design, through deployment and integration, to ongoing management and optimization,
              our dedicated team provides comprehensive end-to-end support. We handle the complexity of IoT connectivity so you can focus on what matters most: your business.
            </p>
          </div>
          <div class="bg-background-dark rounded-lg p-4 border border-border-dark">
            <h3 class="font-medium text-white mb-2 flex items-center gap-2">
              <span class="material-symbols-outlined text-blue-400 text-lg">visibility</span>
              Our Vision
            </h3>
            <p class="text-text-secondary text-sm leading-relaxed">
              We envision a world where IoT connectivity is seamless, intelligent, and accessible to businesses of all sizes.
              Our goal is to democratize IoT management by providing enterprise-grade tools and expert guidance that empower organizations
              to unlock the transformative potential of connected devices. Through continuous innovation, exceptional service, and unwavering commitment
              to our clients' success, we strive to be the global leader in IoT connectivity management solutions.
            </p>
          </div>
          <div class="bg-background-dark rounded-lg p-4 border border-border-dark">
            <h3 class="font-medium text-white mb-2 flex items-center gap-2">
              <span class="material-symbols-outlined text-green-400 text-lg">verified</span>
              Our Commitment
            </h3>
            <p class="text-text-secondary text-sm leading-relaxed">
              Every client receives personalized attention from our expert consultants who understand the unique challenges of IoT deployments.
              Whether you're managing a handful of devices or scaling to millions, our team provides proactive support,
              strategic insights, and hands-on assistance to ensure your IoT infrastructure delivers maximum value.
              Your success is our success.
            </p>
          </div>
        </div>
      </div>

      <!-- Contact Section -->
      <div class="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-xl p-6 mb-6">
        <h2 class="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <span class="material-symbols-outlined text-primary">contact_support</span>
          Get in Touch
        </h2>
        <p class="text-text-secondary mb-4">
          Ready to transform your IoT connectivity management? Our team of experts is here to help.
        </p>
        <div class="grid md:grid-cols-2 gap-4">
          <a
            href="mailto:info@ioto-communications.com"
            class="flex items-center gap-3 bg-surface-dark/50 rounded-lg p-4 border border-border-dark hover:border-primary/50 transition-colors group"
          >
            <span class="material-symbols-outlined text-primary group-hover:scale-110 transition-transform">mail</span>
            <div>
              <p class="text-white font-medium">Email Us</p>
              <p class="text-text-secondary text-sm">info@ioto-communications.com</p>
            </div>
          </a>
          <a
            href="https://www.ioto-communications.com"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-3 bg-surface-dark/50 rounded-lg p-4 border border-border-dark hover:border-primary/50 transition-colors group"
          >
            <span class="material-symbols-outlined text-primary group-hover:scale-110 transition-transform">language</span>
            <div>
              <p class="text-white font-medium">Visit Website</p>
              <p class="text-text-secondary text-sm">www.ioto-communications.com</p>
            </div>
          </a>
        </div>
      </div>

      <!-- Version Info -->
      <div class="text-center text-text-secondary text-sm">
        <p>IoTo Portal v2.0</p>
        <p class="mt-1">&copy; {{ new Date().getFullYear() }} IoTo Communications. All rights reserved.</p>
      </div>

      <!-- Footer Text -->
      <div class="text-center mt-8">
        <p class="text-text-secondary text-sm">自転車を持つ男</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* No additional styles needed - all styling is done via Tailwind classes */
</style>
