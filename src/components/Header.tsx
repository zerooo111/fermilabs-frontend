import AirdropPopover from './AirdropPopover';
import { ConnectWallet } from './ConnectWallet';

const Header = () => {
  return (
    <nav className="w-full  flex items-center">
      <div className="flex items-center justify-between flex-1">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold">Fermi</span>
        </div>
        <div className="flex items-center gap-2">
          <AirdropPopover />
          <ConnectWallet />
        </div>
      </div>
    </nav>
  );
};

export default Header;
