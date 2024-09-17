import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { Search, ChevronDown, Clipboard } from "lucide-react";

const App = () => {
  const [walletAddress, setWalletAddress] = useState("");
  const [ensDomain, setEnsDomain] = useState("");
  const [approvals, setApprovals] = useState([]);
  const [totalValueAtRisk, setTotalValueAtRisk] = useState(0);
  const [totalApprovals, setTotalApprovals] = useState(0);
  const [resolvedAddress, setResolvedAddress] = useState("");
  const [userDomain, setUserDomain] = useState("");
  const [nativeBalance, setNativeBalance] = useState("");
  const [usdValue, setUsdValue] = useState("");
  const [sortOption, setSortOption] = useState("newest-to-oldest");
  const [filterOption, setFilterOption] = useState("everything");
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (connected) {
      fetchNativeBalance();
    }
  }, [connected, resolvedAddress]);

  const isEnsDomain = (input) => input.endsWith(".eth");

  const resolveEnsToAddress = async (domain) => {
    try {
      const response = await fetch(
        `https://deep-index.moralis.io/api/v2.2/resolve/ens/${domain}`,
        {
          headers: {
            accept: "application/json",
            "X-API-Key": process.env.REACT_APP_MORALIS_API_KEY,
          },
        }
      );
      const data = await response.json();
      if (data.address) {
        setResolvedAddress(data.address);
        setUserDomain(domain);
        return data.address;
      }
    } catch (error) {
      console.error("Error resolving ENS:", error);
    }
    return null;
  };

  const resolveAddressToEns = async (address) => {
    try {
      const response = await fetch(
        `https://deep-index.moralis.io/api/v2.2/resolve/${address}/reverse`,
        {
          headers: {
            accept: "application/json",
            "X-API-Key": process.env.REACT_APP_MORALIS_API_KEY,
          },
        }
      );
      const data = await response.json();
      if (data.name) {
        setUserDomain(data.name);
      }
    } catch (error) {
      console.error("Error resolving address to ENS:", error);
    }
  };

  const fetchApprovals = async (address) => {
    try {
      const response = await fetch(
        `https://deep-index.moralis.io/api/v2.2/wallets/${address}/approvals?chain=eth`,
        {
          headers: {
            accept: "application/json",
            "X-API-Key": process.env.REACT_APP_MORALIS_API_KEY,
          },
        }
      );
      const data = await response.json();
      const usdRisk = data.result.reduce(
        (acc, approval) => acc + (parseFloat(approval.token.usd_at_risk) || 0),
        0
      );
      setTotalValueAtRisk(usdRisk);
      setTotalApprovals(data.result.length);
      setApprovals(data.result);
    } catch (error) {
      console.error("Error fetching approvals:", error);
    }
  };

  const fetchNativeBalance = async (address) => {
    try {
      const response = await fetch(
        `https://deep-index.moralis.io/api/v2.2/wallets/${address}/tokens?chain=eth`,
        {
          headers: {
            accept: "application/json",
            "X-API-Key": process.env.REACT_APP_MORALIS_API_KEY,
          }
        }
      );
      const data = await response.json();
      const ethData = data.result.find(
        (token) =>
          token.token_address === "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
      );
      if (ethData) {
        setNativeBalance(ethData.balance_formatted);
        setUsdValue(ethData.usd_value.toFixed(2));
      }
    } catch (error) {
      console.error("Error fetching native balance:", error);
    }
  };

  const handleSearch = async () => {
    let address = walletAddress;
  
    if (isEnsDomain(walletAddress)) {
      address = await resolveEnsToAddress(walletAddress);
    } else {
      setResolvedAddress(walletAddress);
      setUserDomain(""); // Reset domain
      await resolveAddressToEns(walletAddress);
    }
  
    if (address) {
      // Set resolved address to ensure fetchNativeBalance works
      setResolvedAddress(address);
      fetchApprovals(address);
      fetchNativeBalance(address); // Ensure balance is fetched after ENS is resolved
    }
  };

  const handleInputKeyPress = (event) => {
    if (event.key === "Enter") {
      handleSearch();
    }
  };

  const shortenAddress = (address) =>
    `${address.slice(0, 6)}...${address.slice(-4)}`;

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert("Copied to clipboard");
  };

  const checkUnlimitedAmount = (value) => {
    const threshold = 	79228162514;
    return parseFloat(value) >= threshold;
  };

  const sortApprovals = (approvals) => {
    switch (sortOption) {
      case "newest-to-oldest":
        return approvals.sort(
          (a, b) => new Date(b.block_timestamp) - new Date(a.block_timestamp)
        );
      case "oldest-to-newest":
        return approvals.sort(
          (a, b) => new Date(a.block_timestamp) - new Date(b.block_timestamp)
        );
      case "approved-amount-low-high":
        return approvals.sort(
          (a, b) => parseFloat(a.value_formatted) - parseFloat(b.value_formatted)
        );
      case "approved-amount-high-low":
        return approvals.sort(
          (a, b) => parseFloat(b.value_formatted) - parseFloat(a.value_formatted)
        );
      case "value-at-risk-low-high":
        return approvals.sort(
          (a, b) =>
            parseFloat(a.token.usd_at_risk || 0) -
            parseFloat(b.token.usd_at_risk || 0)
        );
      case "value-at-risk-high-low":
        return approvals.sort(
          (a, b) =>
            parseFloat(b.token.usd_at_risk || 0) -
            parseFloat(a.token.usd_at_risk || 0)
        );
      case "asset-a-z":
        return approvals.sort((a, b) =>
          a.token.symbol.localeCompare(b.token.symbol)
        );
      case "asset-z-a":
        return approvals.sort((a, b) =>
          b.token.symbol.localeCompare(a.token.symbol)
        );
      default:
        return approvals;
    }
  };

  const filterApprovals = (approvals) => {
    switch (filterOption) {
      case "unlimited":
        return approvals.filter((approval) =>
          checkUnlimitedAmount(approval.value_formatted)
        );
      case "limited":
        return approvals.filter(
          (approval) => !checkUnlimitedAmount(approval.value_formatted)
        );
      default:
        return approvals;
    }
  };

  const sortedApprovals = sortApprovals(filterApprovals([...approvals]));

  const connectWallet = async () => {
    if (window.ethereum) {
      const tempProvider = new ethers.BrowserProvider(window.ethereum);
      const tempSigner = await tempProvider.getSigner();
      await tempProvider.send("eth_requestAccounts", []);
      const address = await tempSigner.getAddress();
      setProvider(tempProvider);
      setSigner(tempSigner);
      setResolvedAddress(address);
      setConnected(true);
    } else {
      alert("Please install MetaMask to use this feature!");
    }
  };

  const revokeApproval = async (tokenContractAddress, spenderAddress) => {
    if (!connected) {
      connectWallet();
      return;
    }
    try {
      const tokenContract = new ethers.Contract(
        tokenContractAddress, // replace with actual token contract address
        ["function approve(address spender, uint256 amount)"],
        signer
      );
      await tokenContract.approve(spenderAddress, 0);
      alert("Approval revoked successfully!");
    } catch (error) {
      console.error("Error revoking approval:", error);
    }
  };

  return (
    <div
      style={{ minHeight: "100vh" }}
      className="bg-black text-white p-4 font-sans"
    >
      <header className="flex justify-between items-center mb-4 border-b border-white pb-4">
  <h1 className="text-2xl font-bold">moralis</h1>
  <nav className="flex items-center space-x-4">
    <a
      href="https://developers.moralis.com/"
      target="_blank"
      rel="noopener noreferrer"
      className="text-white"
    >
      Moralis Devs
    </a>
    <a
      href="https://docs.moralis.io/"
      target="_blank"
      rel="noopener noreferrer"
      className="text-white"
    >
      API Docs
    </a>
    <a
      href="https://docs.moralis.io/web3-data-api/evm/reference/wallet-api/get-wallet-token-approvals"
      target="_blank"
      rel="noopener noreferrer"
      className="text-white"
    >
      Token Approvals API
    </a>
    <button
      className="px-3 py-1 bg-black text-white border border-white rounded"
      onClick={connectWallet}
    >
      {connected ? shortenAddress(resolvedAddress) : "Connect Wallet"}
    </button>
  </nav>
</header>


      <div className="mb-8">
        <div className="relative w-full">
          <Search
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white"
            size={20}
          />
          <input
            type="text"
            placeholder="Search Accounts by Address or Domain"
            className="w-full bg-black text-white border border-white py-2 pl-10 pr-4 rounded-md"
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            onKeyPress={handleInputKeyPress}
          />
        </div>
      </div>

      {/* Centered content wrapper */}
      <div className="w-full lg:w-3/4 mx-auto">
        <div className="bg-black text-white border border-white rounded-lg p-4 mb-2">
          <div className="text-xl font-bold">
            {userDomain
              ? userDomain
              : resolvedAddress
              ? resolvedAddress
              : walletAddress}
          </div>
          <div className="flex items-center space-x-2">
            <div className="text-sm">
              {shortenAddress(resolvedAddress || walletAddress)}{" "}
            </div>
            <Clipboard
              className="cursor-pointer"
              size={18}
              onClick={() => copyToClipboard(resolvedAddress || walletAddress)}
            />
            
          </div>
          <div className="text-sm">
          {parseFloat(nativeBalance).toFixed(4)} ETH (${usdValue})
          </div >
        </div>

        <div className="flex justify-between mb-2">
          {/* Sort and Filter options */}
          <div className="flex-[7] mr-4">
            <div className="bg-black text-white border border-white rounded-lg p-2 mb-1">
              <select
                className="bg-black text-white border border-white rounded px-3 py-2 w-full"
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
              >
                <option value="newest-to-oldest">
                  Last Updated: Newest to Oldest
                </option>
                <option value="oldest-to-newest">
                  Last Updated: Oldest to Newest
                </option>
                <option value="approved-amount-low-high">
                  Approved Amount: Low to High
                </option>
                <option value="approved-amount-high-low">
                  Approved Amount: High to Low
                </option>
                <option value="value-at-risk-low-high">
                  Value at Risk: Low to High
                </option>
                <option value="value-at-risk-high-low">
                  Value at Risk: High to Low
                </option>
                <option value="asset-a-z">Asset Name: A to Z</option>
                <option value="asset-z-a">Asset Name: Z to A</option>
              </select>
            </div>
            <div className="bg-black text-white border border-white rounded-lg p-2">
              <select
                className="bg-black text-white border border-white rounded px-3 py-2 w-full"
                value={filterOption}
                onChange={(e) => setFilterOption(e.target.value)}
              >
                <option value="everything">Showing Everything</option>
                <option value="limited">Showing Limited Values</option>
                <option value="unlimited">Showing Unlimited Values</option>
              </select>
            </div>
          </div>

          {/* Second box with total approvals and value at risk */}
          <div className="bg-black text-white border border-white rounded-lg p-4 flex-[2] flex justify-center items-center">
            <div className="flex justify-between w-full text-center">
              <div className="mr-4">
                <div className="text-sm">Total Approvals</div>
                <div className="text-2xl font-bold">{totalApprovals}</div>
              </div>
              <div>
                <div className="text-sm">Total Value at Risk</div>
                <div className="text-2xl font-bold">
                  ${totalValueAtRisk.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </div>

        <table
          className="w-full border border-white rounded-lg"
          style={{ borderCollapse: "separate", borderSpacing: "0" }}
        >
          <thead>
            <tr className="text-left text-white border-b border-white">
              <th className="pb-2 px-4 py-2">Asset</th>
              <th className="pb-2 px-4 py-2">Type</th>
              <th className="pb-2 px-4 py-2">Approved Amount</th>
              <th className="pb-2 px-4 py-2">Value at Risk</th>
              <th className="pb-2 px-4 py-2">Approved Spender</th>
              <th className="pb-2 px-4 py-2">Last Updated</th>
              <th className="pb-2 px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedApprovals.map((approval, index) => (
              <tr key={index} className="border-t border-white">
                <td className="py-2 flex flex-col items-start px-4">
                  {/* Logo and Symbol */}
                  <div className="flex items-center">
                    <img
                      src={approval.token.logo}
                      alt={`${approval.token.symbol} logo`}
                      className="w-6 h-6 rounded-full mr-2"
                    />
                    {approval.token.symbol}
                  </div>
                  {/* Current Balance and USD Value */}
                  <div className="text-sm text-gray-400">
                    {approval.token.current_balance_formatted
                      ? parseFloat(approval.token.current_balance_formatted).toFixed(4)
                      : "N/A"}{" "}
                    {approval.token.symbol}
                    <br />
                    ($
                    {approval.token.current_balance_formatted
                      ? (
                          approval.token.current_balance_formatted *
                          (approval.token.usd_price || 0)
                        ).toFixed(4)
                      : "N/A"})
                  </div>
                </td>
                <td className="py-2 px-4">
                  <span className="bg-black text-white border border-white text-xs px-2 py-1 rounded">
                    Token
                  </span>
                </td>
                <td className="py-2 px-4">
                  {checkUnlimitedAmount(approval.value_formatted) ? (
                    <span title={parseFloat(approval.value_formatted).toFixed(4)}>
                      Unlimited
                    </span>
                  ) : (
                    parseFloat(approval.value_formatted).toFixed(4)
                  )}
                </td>
                <td className="py-2 px-4">
                  ${parseFloat(approval.token.usd_at_risk || "0").toFixed(4)}
                </td>
                <td className="py-2 px-4">
                  {approval.spender.entity ? (
                    <div className="flex flex-col">
                      {/* Entity Name */}
                      <div>{approval.spender.entity}</div>
                      {/* Shortened Address and Copy Button */}
                      <div className="flex items-center text-sm text-gray-400">
                        {shortenAddress(approval.spender.address)}
                        <Clipboard
                          className="cursor-pointer ml-2"
                          size={16}
                          onClick={() =>
                            copyToClipboard(approval.spender.address)
                          }
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center">
                      {shortenAddress(approval.spender.address)}
                      <Clipboard
                        className="cursor-pointer ml-2"
                        size={16}
                        onClick={() =>
                          copyToClipboard(approval.spender.address)
                        }
                      />
                    </div>
                  )}
                </td>
                <td className="py-2 px-4">
                  {new Date(approval.block_timestamp).toLocaleString()}
                </td>
                <td className="py-2 px-4">
                  <button
                    className="bg-black text-white border border-white text-xs px-2 py-1 rounded"
                    onClick={() =>
                      connected
                        ? revokeApproval(approval.token.address,approval.spender.address)
                        : connectWallet()
                    }
                  >
                    {connected ? "Revoke" : "Connect Wallet"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <footer style={{ textAlign: "center", padding: "50px 0" }}>
  <a href="https://moralis.io?ref=demo-app" target="_blank" rel="noopener noreferrer">
    <img
      src="https://moralis-portfolio-staging-f5f5e6cfeae8.herokuapp.com/images/Powered-by-Moralis-Badge-Text-Grey.svg"
      alt="Powered by Moralis"
      width="200"
    />
  </a>
</footer>
      </div>

      
    </div>
  );
};

export default App;
