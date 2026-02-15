import Link from 'next/link';
import { Gavel, Phone, Mail, MapPin } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-primary-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                <Gavel className="w-4 h-4 text-primary-300" />
              </div>
              <span className="font-heading font-bold text-lg">
                nilam<span className="text-primary-300">it</span>
              </span>
            </div>
            <p className="text-sm text-primary-200 leading-relaxed">
              Bangladesh&apos;s trusted C2C auction marketplace. Buy and sell with confidence through transparent, real-time bidding.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-heading font-semibold text-sm mb-4">Marketplace</h4>
            <ul className="space-y-2">
              <li><Link href="/auctions" className="text-sm text-primary-300 hover:text-white transition-colors">Browse Auctions</Link></li>
              <li><Link href="/auctions/create" className="text-sm text-primary-300 hover:text-white transition-colors">Sell an Item</Link></li>
              <li><Link href="/auctions?category=mobile-phones" className="text-sm text-primary-300 hover:text-white transition-colors">Mobile Phones</Link></li>
              <li><Link href="/auctions?category=electronics" className="text-sm text-primary-300 hover:text-white transition-colors">Electronics</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-heading font-semibold text-sm mb-4">Support</h4>
            <ul className="space-y-2">
              <li><Link href="/how-it-works" className="text-sm text-primary-300 hover:text-white transition-colors">How It Works</Link></li>
              <li><Link href="/safety" className="text-sm text-primary-300 hover:text-white transition-colors">Safety Tips</Link></li>
              <li><Link href="/faq" className="text-sm text-primary-300 hover:text-white transition-colors">FAQ</Link></li>
              <li><Link href="/contact" className="text-sm text-primary-300 hover:text-white transition-colors">Contact Us</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-heading font-semibold text-sm mb-4">Contact</h4>
            <ul className="space-y-3">
              <li className="flex items-center gap-2 text-sm text-primary-300">
                <MapPin className="w-4 h-4 flex-shrink-0" /> Dhaka, Bangladesh
              </li>
              <li className="flex items-center gap-2 text-sm text-primary-300">
                <Phone className="w-4 h-4 flex-shrink-0" /> +880 1XX-XXXX-XXX
              </li>
              <li className="flex items-center gap-2 text-sm text-primary-300">
                <Mail className="w-4 h-4 flex-shrink-0" /> support@nilamit.com
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 mt-10 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-primary-400">
            © {new Date().getFullYear()} nilamit.com — All rights reserved.
          </p>
          <div className="flex gap-4">
            <Link href="/privacy" className="text-xs text-primary-400 hover:text-white transition-colors">Privacy</Link>
            <Link href="/terms" className="text-xs text-primary-400 hover:text-white transition-colors">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
