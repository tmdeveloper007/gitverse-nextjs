import React from 'react'
import Link from 'next/link'
import { GitBranch, Twitter, Github, Linkedin, Mail } from 'lucide-react'

export const Footer: React.FC = () => {
  return (
    <footer className="bg-muted/30 text-muted-foreground border-t border-border/50">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-primary rounded-lg">
                <GitBranch className="text-primary-foreground" size={24} />
              </div>
              <span className="text-xl font-heading font-bold text-foreground">
                Git<span className="text-gradient">Verse</span>
              </span>
            </Link>
            <p className="text-sm">
              Contribution made easy with repo visualization and PR Mentor.
            </p>
          </div>

          {/* Product */}
          <div>
            <h3 className="font-semibold text-foreground mb-4">Product</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#features" className="hover:text-primary transition-colors">
                  Features
                </a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-primary transition-colors">
                  Pricing
                </a>
              </li>
              <li>
                <a href="#how-it-works" className="hover:text-primary transition-colors">
                  How it Works
                </a>
              </li>
              <li>
                <span title="Coming soon" className="cursor-not-allowed opacity-50 hover:text-current">Documentation</span>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="font-semibold text-foreground mb-4">Company</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <span title="Coming soon" className="cursor-not-allowed opacity-50">About</span>
              </li>
              <li>
                <span title="Coming soon" className="cursor-not-allowed opacity-50">Blog</span>
              </li>
              <li>
                <span title="Coming soon" className="cursor-not-allowed opacity-50">Careers</span>
              </li>
              <li>
                <span title="Coming soon" className="cursor-not-allowed opacity-50">Contact</span>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-semibold text-foreground mb-4">Legal</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <span title="Coming soon" className="cursor-not-allowed opacity-50 hover:text-current">Privacy Policy</span>
              </li>
              <li>
                <span title="Coming soon" className="cursor-not-allowed opacity-50 hover:text-current">Terms of Service</span>
              </li>
              <li>
                <span title="Coming soon" className="cursor-not-allowed opacity-50 hover:text-current">Security</span>
              </li>
              <li>
                <span title="Coming soon" className="cursor-not-allowed opacity-50 hover:text-current">Cookie Policy</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="mt-12 pt-8 border-t border-border/50 flex flex-col md:flex-row justify-between items-center">
          <p className="text-sm">© 2026 GitVerse. All rights reserved.</p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors"
            >
              <Twitter size={20} />
            </a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors"
            >
              <Github size={20} />
            </a>
            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors"
            >
              <Linkedin size={20} />
            </a>
            <a href="mailto:hello@gitverse.com" className="hover:text-primary transition-colors">
              <Mail size={20} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
