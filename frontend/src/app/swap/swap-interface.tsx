"use client"

import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowRight, ChevronDown, Info, ChevronLeft } from "lucide-react"
import Image from "next/image"
import { TransactionTicker } from "@/components/ui/transaction-ticker"
import { CircularTimer } from "@/components/ui/circular-timer"

// ... (inside the component)



interface Token {
  symbol: string
  name: string
  logo: string
  price: number // Price in INR
}

const tokens: Record<string, Token> = {
  INR: { symbol: "INR", name: "Indian Rupee", logo: "/inr.png", price: 1 },
  USDC: { symbol: "USDC", name: "USD Coin", logo: "/usdc.png", price: 88.5 }, // Example price
}

export default function SwapInterface() {
  const router = useRouter()
  const [sellToken, setSellToken] = useState<string>("INR")
  const [buyToken, setBuyToken] = useState<string>("USDC")
  const [sellAmount, setSellAmount] = useState<string>("")
  const [buyAmount, setBuyAmount] = useState<string>("")
  const [isSellDropdownOpen, setIsSellDropdownOpen] = useState(false)
  const [isBuyDropdownOpen, setIsBuyDropdownOpen] = useState(false)
  const [exchangeRate, setExchangeRate] = useState(88.5);
  const [customWalletAddress, setCustomWalletAddress] = useState("")

  // Payment Flow State
  const [step, setStep] = useState<'input' | 'payment' | 'success'>('input')
  const [timeLeft, setTimeLeft] = useState(300) // 5 minutes in seconds
  const [utr, setUtr] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [orderId, setOrderId] = useState<string | null>(null)

  const [orderStatus, setOrderStatus] = useState<'PROCESSING' | 'COMPLETED' | 'FAILED'>('PROCESSING')
  const [isLongWait, setIsLongWait] = useState(false)


  // Timer Logic
  useEffect(() => {
    let timer: NodeJS.Timeout
    if ((step === 'payment' || (step === 'success' && orderStatus === 'PROCESSING')) && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1)
      }, 1000)
    }
    return () => clearInterval(timer)
  }, [step, timeLeft, orderStatus])

  useEffect(() => {
    let pollTimer: NodeJS.Timeout
    if (step === 'success' && orderId) {
      // Reset timer for success screen
      setTimeLeft(300)

      pollTimer = setInterval(async () => {
        try {
          const response = await fetch(`/api/orders/${orderId}`)
          const data = await response.json()
          if (data.success) {
            const status = data.data.status
            if (status === 'COMPLETED') {
              setOrderStatus('COMPLETED')
              clearInterval(pollTimer)
            } else if (status === 'FAILED' || status === 'CANCELLED') {
              setOrderStatus('FAILED')
              clearInterval(pollTimer)
            }
          }
        } catch (error) {
          console.error("Error polling order status:", error)
        }
      }, 3000) // Poll every 3 seconds
    }
    return () => clearInterval(pollTimer)
  }, [step, orderId])

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Calculate conversion
  useEffect(() => {
    if (!sellAmount) {
      setBuyAmount("")
      return
    }

    const amount = parseFloat(sellAmount)
    if (isNaN(amount)) return

    if (sellToken === 'INR' && buyToken === 'USDC') {
      const amount = parseFloat(sellAmount);
      // Use your fetched exchangeRate
      const receivedUSDC = amount / exchangeRate;
      setBuyAmount(receivedUSDC.toFixed(4));
    }
  }, [sellAmount, sellToken, buyToken])

  // Load stored wallet on mount
  useEffect(() => {
    const stored = localStorage.getItem("wallet-addr")
    if (stored) {
      setCustomWalletAddress(stored)
    }
  }, [])

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const res = await fetch('http://localhost:3001/api/prices'); // Use your actual backend URL
        const data = await res.json();
        if (data.success) {
          setExchangeRate(data.finalRate);
        }
      } catch (err) {
        console.error("Failed to load price");
      }
    };
    fetchPrice();
    const interval = setInterval(fetchPrice, 30000);
    return () => clearInterval(interval);

  }, []);

  const handleSwapTokens = () => {
    setSellToken(buyToken)
    setBuyToken(sellToken)
    setSellAmount(buyAmount)
    setBuyAmount(sellAmount)
  }

  const handleTokenSelect = (type: 'sell' | 'buy', token: string) => {
    if (type === 'sell') {
      if (token === buyToken) {
        setBuyToken(sellToken)
      }
      setSellToken(token)
      setIsSellDropdownOpen(false)
    } else {
      if (token === sellToken) {
        setSellToken(buyToken)
      }
      setBuyToken(token)
      setIsBuyDropdownOpen(false)
    }
  }



  const handleSwapNow = async () => {
    // Auth Check
    const token = localStorage.getItem("auth-token")
    const userId = localStorage.getItem("user-id")
    const storedWallet = localStorage.getItem("wallet-addr")
    // Use custom address if entered, otherwise stored, otherwise fallback
    const walletAddress = (customWalletAddress?.trim()) || storedWallet || "86xCnPeV69n6t3DnyGvkKobf9FdN2ss9495ej8mpCrYd"

    if (!token || !userId) {
      router.push("/login")
      return
    }

    if (!sellAmount || parseFloat(sellAmount) <= 0) {
      alert("Please enter a valid amount")
      return
    }

    try {
      setIsSubmitting(true)
      setIsLongWait(false)
      const waitTimer = setTimeout(() => setIsLongWait(true), 3000)

      const response = await fetch("/api/orders", {

        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          amount: parseFloat(sellAmount),
          walletAddress: walletAddress
        }),
      })

      const data = await response.json()

      if (data.success) {
        setOrderId(data.data.order.id)
        setStep('payment')
        setTimeLeft(300) // Reset timer
      } else {
        alert("Failed to create order: " + data.message)
      }
    } catch (error) {
      console.error("Error creating order:", error)
      alert("Failed to create order. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePaymentSubmit = async () => {
    if (utr.length !== 12) {
      alert("Please enter a valid 12-digit UTR number")
      return
    }

    if (!orderId) {
      alert("Order ID not found. Please try again.")
      return
    }

    const userId = localStorage.getItem("user-id")

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/orders/${orderId}/utr`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          utrNumber: utr,
          userId
        }),
      })

      const data = await response.json()

      if (data.success) {
        setStep('success')
      } else {
        alert("Failed to submit payment: " + data.message)
      }
    } catch (error) {
      console.error("Error submitting payment:", error)
      alert("Failed to submit payment. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-20 overflow-x-hidden relative bg-[#0a0a0a] font-rajdhani">

      {/* Transaction Ticker */}
      <TransactionTicker />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-5xl relative"
      >
        {/* Network & Live Rate Indicator - Positioned relative to the main container, into the notch space */}
        <div className="absolute top-0 left-[200px] flex items-center gap-4 z-30">
          <div className="flex items-center gap-2 bg-[#0F0F0F] border border-[#CCFF00]/30 px-4 py-2 rounded-full shadow-[0_0_15px_rgba(204,255,0,0.15)]">
            <div className="w-2 h-2 rounded-full bg-[#CCFF00] animate-pulse shadow-[0_0_8px_#CCFF00]" />
            <span className="text-white text-sm font-bold font-mono tracking-wider">
              1 USDC ≈ ₹{exchangeRate.toFixed(2)}
            </span>
          </div>

          <div className="hidden md:flex items-center gap-2 bg-[#0F0F0F] border border-blue-500/30 px-4 py-2 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.15)]">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_#3b82f6]" />
            <span className="text-blue-400 text-sm font-bold font-mono tracking-wider">
              SOLANA TESTNET
            </span>
          </div>
        </div>
        {/* Cyberpunk Card Container */}
        <div className="relative group filter drop-shadow-[0_0_10px_rgba(204,255,0,0.1)]">

          {/* Border/Background Layer */}
          <div
            className="absolute inset-0 bg-[#CCFF00]/30"
            style={{
              clipPath: "polygon(0 0, 180px 0, 210px 40px, 100% 40px, 100% calc(100% - 30px), calc(100% - 30px) 100%, 0 100%)"
            }}
          />

          {/* Inner Content Layer */}
          <div
            className="relative bg-[#0F0F0F] min-h-[600px]"
            style={{
              clipPath: "polygon(1px 1px, 179px 1px, 209px 41px, calc(100% - 1px) 41px, calc(100% - 1px) calc(100% - 31px), calc(100% - 31px) calc(100% - 1px), 1px calc(100% - 1px))",
              marginTop: "1px",
              marginLeft: "1px",
              marginRight: "1px",
              marginBottom: "1px"
            }}
          >
            {/* Tab Content */}
            <div className="absolute top-0 left-0 w-[180px] h-[40px] flex items-center justify-center">
              <span className="text-[#CCFF00] font-bold tracking-wider text-sm">
                {step === 'input' ? 'TRADE DETAILS' : step === 'payment' ? 'PAYMENT' : ''}
              </span>
            </div>



            {/* Main Content Area */}
            <div className="pt-16 pb-8 px-8 md:px-12">
              <AnimatePresence mode="wait">
                {step === 'input' && (
                  <motion.div
                    key="input"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="flex flex-col relative z-10"
                  >
                    <div className="flex flex-col md:flex-row w-full">
                      {/* Left Side: YOU ARE SELLING */}
                      <div className="flex-1 md:pr-12 border-b md:border-b-0 md:border-r border-[#CCFF00]/10 relative pb-8 md:pb-0">
                        <h3 className="text-[#CCFF00] font-bold text-center mb-10 tracking-widest text-lg uppercase">You are Selling</h3>

                        <div className="space-y-8">
                          {/* Token Selector */}
                          <div className="space-y-2 relative">
                            <label className="text-gray-400 text-xs font-bold tracking-wider uppercase">Token</label>
                            <button
                              onClick={() => setIsSellDropdownOpen(!isSellDropdownOpen)}
                              className="w-full bg-[#141414] border border-[#333] hover:border-[#CCFF00]/50 rounded-xl p-4 flex items-center justify-between transition-all duration-300 group"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-white/10 p-1">
                                  <Image src={tokens[sellToken].logo} alt={sellToken} width={32} height={32} className="rounded-full" />
                                </div>
                                <span className="text-white font-bold text-xl">{tokens[sellToken].symbol}</span>
                              </div>
                              <ChevronDown className={`w-5 h-5 text-gray-500 group-hover:text-[#CCFF00] transition-transform duration-300 ${isSellDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {/* Dropdown */}
                            <AnimatePresence>
                              {isSellDropdownOpen && (
                                <motion.div
                                  initial={{ opacity: 0, y: -10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -10 }}
                                  className="absolute top-full left-0 right-0 mt-2 bg-[#141414] border border-[#333] rounded-xl overflow-hidden z-50 shadow-2xl"
                                >
                                  {Object.keys(tokens).map((token) => (
                                    <button
                                      key={token}
                                      onClick={() => handleTokenSelect('sell', token)}
                                      className="w-full p-4 flex items-center gap-3 hover:bg-[#CCFF00]/10 transition-colors"
                                    >
                                      <div className="w-6 h-6 rounded-full bg-white/10 p-0.5">
                                        <Image src={tokens[token].logo} alt={token} width={24} height={24} className="rounded-full" />
                                      </div>
                                      <span className="text-white font-bold">{token}</span>
                                    </button>
                                  ))}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                          {/* Amount Input */}
                          <div className="space-y-2">
                            <label className="text-gray-400 text-xs font-bold tracking-wider uppercase">Amount</label>
                            <div className="bg-[#141414] border border-[#333] focus-within:border-[#CCFF00] rounded-xl p-4 flex items-center justify-between transition-all duration-300">
                              <input
                                type="number"
                                value={sellAmount}
                                onChange={(e) => setSellAmount(e.target.value)}
                                placeholder="0.00"
                                className="bg-transparent text-white font-bold text-2xl w-full outline-none placeholder-gray-600"
                              />
                            </div>
                          </div>

                          {/* Value Display */}
                          <div className="flex items-end justify-between pt-4">
                            <div>
                              <div className="text-[#CCFF00] text-sm font-bold mb-1">Value</div>
                              <div className="text-white text-2xl font-bold">
                                {sellToken === 'INR' ? '₹ ' : '$ '}
                                {sellAmount ? (
                                  sellToken === 'INR'
                                    ? parseFloat(sellAmount).toFixed(2)
                                    : ((parseFloat(sellAmount) * tokens[sellToken].price) / 88.5).toFixed(2)
                                ) : '0.00'}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Middle Swap Icon */}
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
                        <button
                          onClick={handleSwapTokens}
                          className="w-12 h-12 bg-[#0a0a0a] border border-[#CCFF00] rounded-full flex items-center justify-center hover:scale-110 transition-transform duration-300 shadow-[0_0_15px_rgba(204,255,0,0.3)] rotate-90 md:rotate-0"
                        >
                          <ArrowRight className="w-5 h-5 text-[#CCFF00]" />
                        </button>
                      </div>

                      {/* Right Side: YOU ARE BUYING */}
                      <div className="flex-1 md:pl-12 pt-8 md:pt-0 relative">
                        <h3 className="text-[#CCFF00] font-bold text-center mb-10 tracking-widest text-lg uppercase">You are Buying</h3>

                        <div className="space-y-8">
                          {/* Token Selector */}
                          <div className="space-y-2 relative">
                            <label className="text-gray-400 text-xs font-bold tracking-wider uppercase">Token</label>
                            <button
                              onClick={() => setIsBuyDropdownOpen(!isBuyDropdownOpen)}
                              className="w-full bg-[#141414] border border-[#333] hover:border-[#CCFF00]/50 rounded-xl p-4 flex items-center justify-between transition-all duration-300 group"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-white/10 p-1">
                                  <Image src={tokens[buyToken].logo} alt={buyToken} width={32} height={32} className="rounded-full" />
                                </div>
                                <span className="text-white font-bold text-xl">{tokens[buyToken].symbol}</span>
                              </div>
                              <ChevronDown className={`w-5 h-5 text-gray-500 group-hover:text-[#CCFF00] transition-transform duration-300 ${isBuyDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {/* Dropdown */}
                            <AnimatePresence>
                              {isBuyDropdownOpen && (
                                <motion.div
                                  initial={{ opacity: 0, y: -10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -10 }}
                                  className="absolute top-full left-0 right-0 mt-2 bg-[#141414] border border-[#333] rounded-xl overflow-hidden z-50 shadow-2xl"
                                >
                                  {Object.keys(tokens).map((token) => (
                                    <button
                                      key={token}
                                      onClick={() => handleTokenSelect('buy', token)}
                                      className="w-full p-4 flex items-center gap-3 hover:bg-[#CCFF00]/10 transition-colors"
                                    >
                                      <div className="w-6 h-6 rounded-full bg-white/10 p-0.5">
                                        <Image src={tokens[token].logo} alt={token} width={24} height={24} className="rounded-full" />
                                      </div>
                                      <span className="text-white font-bold">{token}</span>
                                    </button>
                                  ))}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                          {/* Amount Input (Read Only) */}
                          <div className="space-y-2">
                            <label className="text-gray-400 text-xs font-bold tracking-wider uppercase">Amount</label>
                            <div className="bg-[#141414] border border-[#333] rounded-xl p-4 flex items-center justify-between">
                              <input
                                type="text"
                                value={buyAmount}
                                readOnly
                                placeholder="0.00"
                                className="bg-transparent text-white font-bold text-2xl w-full outline-none placeholder-gray-600 cursor-default"
                              />
                            </div>
                          </div>

                          {/* Value Display */}
                          <div className="flex items-end justify-between pt-4">
                            <div>
                              <div className="text-[#CCFF00] text-sm font-bold mb-1">Value</div>
                              <div className="text-white text-2xl font-bold">
                                {buyToken === 'INR' ? '₹ ' : '$ '}
                                {buyAmount ? (
                                  buyToken === 'INR'
                                    ? parseFloat(buyAmount).toFixed(2)
                                    : ((parseFloat(buyAmount) * tokens[buyToken].price) / 88.5).toFixed(2)
                                ) : '0.00'}
                              </div>
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>

                    {/* Wallet Address Input - Full Width */}
                    <div className="w-full mt-8 pt-8 border-t border-[#CCFF00]/10">
                      <div className="space-y-2">
                        <label className="text-gray-400 text-xs font-bold tracking-wider uppercase">Solana Wallet Address</label>
                        <div className="bg-[#141414] border border-[#333] focus-within:border-[#CCFF00] rounded-xl p-4 flex items-center justify-between transition-all duration-300">
                          <input
                            type="text"
                            value={customWalletAddress}
                            onChange={(e) => setCustomWalletAddress(e.target.value)}
                            placeholder="Enter your Solana wallet address"
                            className="bg-transparent text-white font-mono text-sm w-full outline-none placeholder-gray-600"
                          />
                        </div>
                        <p className="text-xs text-gray-500">The USDC will be sent to this address.</p>
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="mt-8 flex justify-center">
                      <button
                        onClick={handleSwapNow}
                        disabled={isSubmitting}
                        className="group relative inline-flex items-center justify-center px-12 py-4 bg-[#cbff00] text-black font-bold text-xl uppercase tracking-wider clip-path-button hover:shadow-[0_0_30px_rgba(203,255,0,0.5)] font-monument w-full md:w-auto rounded-xl transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed"
                      >
                        <span className="relative z-10">
                          {isSubmitting ? (
                            isLongWait ? 'CONNECTING...' : 'PROCESSING...'
                          ) : 'SWAP NOW'}
                        </span>
                      </button>
                    </div>

                  </motion.div>
                )}

                {step === 'payment' && (
                  <motion.div
                    key="payment"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="flex flex-col relative"
                  >
                    {/* Back Button */}
                    <div className="w-full flex justify-start mb-6">
                      <button
                        onClick={() => setStep('input')}
                        className="text-gray-400 hover:text-[#CCFF00] flex items-center gap-2 transition-colors group"
                      >
                        <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        Back
                      </button>
                    </div>

                    <div className="flex flex-col md:flex-row gap-8 w-full">
                      {/* QR Code Section */}
                      <div className="flex-1 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-[#CCFF00]/10 pb-8 md:pb-0 md:pr-8">
                        <div className="w-64 h-64 bg-white p-4 rounded-xl mb-6 relative group">
                          {/* Placeholder QR */}
                          <div className="w-full h-full bg-black flex items-center justify-center relative overflow-hidden">
                            <Image
                              src="/payment-qr.png"
                              alt="Payment QR Code"
                              fill
                              className="object-cover"
                            />
                          </div>
                        </div>
                        <div className="text-center space-y-2">
                          <p className="text-gray-400 text-sm">Scan with any UPI App</p>
                          <div className="flex items-center gap-2 justify-center bg-[#141414] px-4 py-2 rounded-lg border border-[#333]">
                            <span className="text-white font-mono">8302906048@slc</span>
                            <button className="text-[#CCFF00] text-xs hover:underline">COPY</button>
                          </div>
                        </div>
                      </div>

                      {/* Payment Details Section */}
                      <div className="flex-1 space-y-6">
                        <div className="bg-[#141414] border border-[#333] rounded-xl p-6 space-y-4">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-400">Banking Name</span>
                            <span className="text-white font-bold">NAVEEN KUMAR</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-400">Amount to Pay</span>
                            <span className="text-[#CCFF00] font-bold text-xl">₹ {sellToken === 'INR' ? sellAmount : (parseFloat(sellAmount) * tokens[sellToken].price).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-400">Time Remaining</span>
                            <span className={`font-mono text-xl ${timeLeft < 60 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                              {formatTime(timeLeft)}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-gray-400 text-xs font-bold tracking-wider uppercase">Enter UTR / Reference ID</label>
                          <input
                            type="text"
                            value={utr}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '').slice(0, 12)
                              setUtr(val)
                            }}
                            placeholder="Enter 12-digit UTR number"
                            className="w-full bg-[#141414] border border-[#333] focus:border-[#CCFF00] rounded-xl p-4 text-white font-mono outline-none transition-colors placeholder-gray-600"
                          />
                          <p className="text-xs text-gray-500 text-right">{utr.length}/12 digits</p>
                        </div>

                        <button
                          onClick={handlePaymentSubmit}
                          disabled={utr.length !== 12 || isSubmitting}
                          className="w-full py-4 bg-[#CCFF00] text-black font-bold text-lg rounded-xl hover:bg-[#D4FF00] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                          {isSubmitting ? 'VERIFYING...' : 'SUBMIT PAYMENT'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {step === 'success' && (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center justify-center text-center py-12 relative"
                  >
                    {/* Back Button */}
                    <div className="w-full flex justify-start absolute top-0 left-0">
                      <button
                        onClick={() => setStep('payment')}
                        className="text-gray-400 hover:text-[#CCFF00] flex items-center gap-2 transition-colors group"
                      >
                        <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        Back
                      </button>
                    </div>

                    <div className="h-40 flex items-center justify-center mb-8 relative">
                      <AnimatePresence mode="wait">
                        {orderStatus === 'PROCESSING' ? (
                          <motion.div
                            key="processing"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ duration: 0.5 }}
                          >
                            <CircularTimer timeLeft={timeLeft} totalTime={300} size={160} strokeWidth={8} />
                          </motion.div>
                        ) : (
                          <motion.div
                            key="status-icon"
                            initial={{ opacity: 0, scale: 0.5, rotate: -180 }}
                            animate={{ opacity: 1, scale: 1, rotate: 0 }}
                            transition={{
                              type: "spring",
                              stiffness: 260,
                              damping: 20
                            }}
                            className={`w-32 h-32 rounded-full flex items-center justify-center border-4 ${orderStatus === 'COMPLETED'
                              ? 'bg-[#CCFF00]/10 border-[#CCFF00] shadow-[0_0_50px_rgba(204,255,0,0.3)]'
                              : 'bg-red-500/10 border-red-500 shadow-[0_0_50px_rgba(239,68,68,0.3)]'
                              }`}
                          >
                            {orderStatus === 'COMPLETED' ? (
                              <motion.svg
                                initial={{ pathLength: 0 }}
                                animate={{ pathLength: 1 }}
                                transition={{ duration: 0.5, delay: 0.2 }}
                                className="w-16 h-16 text-[#CCFF00]"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </motion.svg>
                            ) : (
                              <motion.svg
                                initial={{ pathLength: 0 }}
                                animate={{ pathLength: 1 }}
                                transition={{ duration: 0.5, delay: 0.2 }}
                                className="w-16 h-16 text-red-500"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                              </motion.svg>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <h2 className="text-3xl font-bold text-white mb-4">
                      {orderStatus === 'COMPLETED' ? 'Payment Successful!' :
                        orderStatus === 'FAILED' ? 'Verification Failed' :
                          'Verifying Payment...'}
                    </h2>
                    <p className="text-gray-400 max-w-md mx-auto mb-8">
                      {orderStatus === 'COMPLETED' ? 'Your USDC has been sent to your wallet.' :
                        orderStatus === 'FAILED' ? 'We could not verify your payment. Please contact support.' :
                          'Please wait while we verify your transaction. This usually takes less than 5 minutes.'}
                    </p>

                    <div className="bg-[#141414] border border-[#333] rounded-xl p-6 w-full max-w-md space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Transaction ID</span>
                        <span className="text-white font-mono text-sm">#{orderId?.slice(0, 8).toUpperCase()}</span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Status</span>
                        <span className={`font-bold text-sm font-mono ${orderStatus === 'COMPLETED' ? 'text-[#CCFF00]' :
                          orderStatus === 'FAILED' ? 'text-red-500' :
                            'text-[#CCFF00] animate-pulse'
                          }`}>
                          {orderStatus === 'COMPLETED' ? 'SUCCESS' :
                            orderStatus === 'FAILED' ? 'FAILED' :
                              'PROCESSING...'}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setStep('input')
                        setSellAmount("")
                        setBuyAmount("")
                        setUtr("")
                        setOrderStatus('PROCESSING')
                      }}
                      className="mt-8 text-[#CCFF00] hover:underline"
                    >
                      Make another swap
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Action Button - Only show on Input Step */}
        {/* Moved inside the card */}
      </motion.div >
    </div >
  )
}
