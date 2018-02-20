pragma solidity ^0.4.11;
import './zeppelin/SafeMath.sol';
import './zeppelin/StandardToken.sol';
import './interface/iEC23Receiver.sol';
import './interface/iERC23Token.sol';



contract OrcaToken is iERC23Token, StandardToken {

    string public name = "ORCA Token";
    string public symbol = "ORCA";
    uint8 public decimals = 18;
    uint256 public totalSupply = 100 * 1 ether; // 100 Tokens is used as example and will be changes to real amount before the sale

    address private administrationBoard;

    event ContractTransfer(address _from, address _to, uint _value, bytes _data);

    // Constructor may receive administration board contract address
    // Otherwise contract creator will be owner of all tokens
    function OrcaToken(address _administrationBoard) {
        if(_administrationBoard != 0x0) {
            administrationBoard = _administrationBoard;
        } else {
            administrationBoard = msg.sender;
        }
        balances[_administrationBoard] = totalSupply;
    }

    /// @dev Fallback function throws error if someone tries to deposit ether.
    function () payable {
        revert();
    }

    function transfer(address _to, uint _value, bytes _data) returns (bool success) {
        //filtering if the target is a contract with bytecode inside it
        assert(super.transfer(_to, _value)); // do a normal token transfer
        if (isContract(_to)) {
            return contractFallback(msg.sender, _to, _value, _data);
        }
        return true;
    }

    function transferFrom(address _from, address _to, uint _value, bytes _data) returns (bool success) {
        assert(super.transferFrom(_from, _to, _value)); // do a normal token transfer
        if (isContract(_to)) {
            return contractFallback(_from, _to, _value, _data);
        }
        return true;
    }

    function transfer(address _to, uint _value) returns (bool success) {
        return transfer(_to, _value, new bytes(0));
    }

    function transferFrom(address _from, address _to, uint _value) returns (bool success) {
        return transferFrom(_from, _to, _value, new bytes(0));
    }

    //function that is called when transaction target is a contract
    function contractFallback(address _origin, address _to, uint _value, bytes _data) private returns (bool success) {
        ContractTransfer(_origin, _to, _value, _data);
        ERC23Receiver receiver = ERC23Receiver(_to);
        return receiver.tokenFallback(msg.sender, _origin, _value, _data);
    }

    //assemble the given address bytecode. If bytecode exists then the _addr is a contract.
    function isContract(address _addr) private returns (bool is_contract) {
        uint length;
        assembly { length := extcodesize(_addr) }
        return length > 0;
    }
}
