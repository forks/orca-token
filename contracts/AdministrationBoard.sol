pragma solidity ^0.4.11;

import './OrcaToken.sol';
import './zeppelin/SafeMath.sol';

contract AdministrationBoard is SafeMath {

    // Max size of additional owners that can be added to administration board
    uint constant public MAX_OWNER_COUNT = 5;

    uint constant private MIN_CONFIRMATION_MINION_OWNER_COUNT = 2;
    uint256 public constant CROWDFUND_PERCENT_OF_TOTAL = 75;
    uint256 private constant HUNDRED_PERCENT = 100;

    // Confirmations count that tokens can be released to investors
    uint public confirmedTokenReleaseCount;

    // Confirmations count that tokens owner list has to be reset
    uint public confirmedTokenOwnersResetCount;


    event ConfirmationReset(address sender, uint256 createdOn);

    event RevocationReset(address sender, uint256 createdOn);

    event ConfirmationDeletAdmin(address sender, uint256 createdOn);

    event RevocationDeletAdmin(address sender, uint256 createdOn);

    event OwnerAddition(address owner, uint256 createdOn);

    event OwnerRemoval(address owner, uint256 createdOn);

    event AddTokenOwnerSupply(address owner, uint256 supply, uint256 createdOn);

    event ConfirmationTokeRelease(address owner, uint256 createdOn);

    event ConfirmationTokenOwnerReset(address owner, uint256 createdOn);

    event RevokeConfirmationTokenOwnerReset(address owner, uint256 createdOn);

    event TokensReleased(uint256 createdOn);

    event RevokedTokenReleaseConfirmation(address owner, uint256 createdOn);

    // main administration board owner address
    address public mainOwner;

    // dictionary which shows if administration board owner confirmed token release
    mapping (address => bool) private confirmedTokenRelease;

    // administration board owners who confirmed token release
    address[] private ownersConfirmedTokenRelease;

    // dictionary which shows if administration board owner voted for token owners list reset
    mapping (address => bool) private confirmedResetTokenOwners;

    // administration board owners who voted for token owners list reset
    address[] private ownersResetTokenOwners;

    // dictionary that shows which owner voted for which another
    // owner to be removed from administration board owner list
    mapping (address => mapping (address => bool)) private ownersDeletionConfirmations;

    // dictionary that shows how many votes for deletion has administration owner
    mapping (address => uint) private ownerDeletionConfirmationsCount;

    // dictionary that shows if administration board owner (address)
    // was (at least once) voted for remove from administration owners list
    mapping (address => bool) private removalOwners;

    // dictionary that shows if account (address) belongs to administration board owner (administrator)
    mapping (address => bool) private isOwner;

    // addresses of administration board owners (administrators)
    address[] private owners;

    // dictionary that maps assigned token size for investors
    mapping (address => uint) private ownersTokenSupply;

    // token owners (investors) addresses
    address[] private tokenOwners;

    OrcaToken private TOKEN;

    // size of already assigned tokens for investors
    uint256 private assignedTokensSupply;

    // flag if token was released to investors
    bool private _tokensReleased;


    modifier onlyMainOwner() {
        assert(msg.sender == mainOwner);
        _;
    }

    modifier notMainOwner(address owner) {
        assert(owner != mainOwner);
        _;
    }


    modifier ownerRemoveNeedsConfirmation(address owner) {
        assert(removalOwners[owner]);
        _;
    }

    modifier ownerDoesNotExist(address owner) {
        assert(!isOwner[owner]);
        _;
    }

    modifier tokensNotReleased() {
        assert(!_tokensReleased);
        _;
    }

    modifier ownerExists(address owner) {
        assert(isOwner[owner]);
        _;
    }

    modifier confirmedAdminDeletion(address deletableOwner, address owner) {
        assert(ownersDeletionConfirmations[deletableOwner][owner]);
        _;
    }

    modifier notConfirmedAdminDeletion(address deletableOwner, address owner) {
        assert(!ownersDeletionConfirmations[deletableOwner][owner]);
        _;
    }

    modifier notConfirmedTokenRelease(address owner) {
        assert(!confirmedTokenRelease[owner]);
        _;
    }

    modifier hasConfirmedTokenRelease(address owner) {
        assert(confirmedTokenRelease[owner]);
        _;
    }

    modifier notConfirmedTokenOwnerReset(address owner) {
        assert(!confirmedResetTokenOwners[owner]);
        _;
    }

    modifier confirmedTokenOwnerReset(address owner) {
        assert(confirmedResetTokenOwners[owner]);
        _;
    }

    modifier notNull(address _address) {
        assert(_address != 0);
        _;
    }

    modifier validRequirement(uint ownerCount) {
        assert(ownerCount != 0);
        assert(ownerCount <= MAX_OWNER_COUNT + 1);
        _;
    }

    // Constructor can receive additional administration board owners list (max 5 additional owners)
    // Contract creator becomes main owner of administration board contract
    function AdministrationBoard(address[] _owners) public {
        assert(_owners.length == 0 || _owners.length <= MAX_OWNER_COUNT);
        for (uint i = 0; i < _owners.length; i++) {
            assert(!(isOwner[_owners[i]] || _owners[i] == 0 || _owners[i] == msg.sender));
            isOwner[_owners[i]] = true;
        }

        owners = _owners;
        owners.push(msg.sender);
        mainOwner = msg.sender;
        isOwner[msg.sender] = true;
        // ORCA token creation is initiated threw AdministrationBoard contract
        TOKEN = new OrcaToken(address(this));
    }


    /// @dev Fallback function throws error if someone tries to deposit ether.
    function() payable {
        revert();
    }

    /// @return address of ORCA token smart contract
    function tokenAddress() constant public returns(OrcaToken) {
        return TOKEN;
    }

    /// @return Was token released to investors
    function tokensReleased() constant public returns(bool) {
        return _tokensReleased;
    }

    /// @notice Add additional administration board owner
    /// @notice Only main owner can execute owner addition
    /// @notice Owner cannot be added if already exists in owner list
    /// @notice only 5 additional owners can be added to owners list
    /// @param _owner new administration board owner
    function addOwner(address _owner)
    public
    onlyMainOwner
    ownerDoesNotExist(_owner)
    notNull(_owner)
    validRequirement(owners.length + 1)
    {
        isOwner[_owner] = true;
        owners.push(_owner);
        OwnerAddition(_owner, now);
    }

    /// @notice Vote for deletion of additional owner from administration board owners list
    /// @notice Main owner cannot be deleted from owners list
    /// @notice Only owners can vote for deletion
    /// @notice Same owner cannot vote for deletion of another (same) owner more than once
    /// @notice Min three owners (one of them has to be main owner) has to vote for deletion to remove owner from list
    /// @param _owner owner for removal from administration board owners list
    function removeOwner(address _owner)
    public
    ownerExists(msg.sender)
    notMainOwner(_owner)
    notConfirmedAdminDeletion(_owner, msg.sender)
    ownerExists(_owner)
    {
        removalOwners[_owner] = true;
        ownerDeletionConfirmationsCount[_owner] += 1;
        ownersDeletionConfirmations[_owner][msg.sender] = true;
        if (ownerDeletionConfirmationsCount[_owner] >= (MIN_CONFIRMATION_MINION_OWNER_COUNT + 1) && ownersDeletionConfirmations[_owner][mainOwner]) {
            isOwner[_owner] = false;
            for (uint i = 0; i < owners.length - 1; i++) {
                if (owners[i] == _owner) {
                    owners[i] = owners[owners.length - 1];
                    break;
                }
            }
            owners.length -= 1;

            OwnerRemoval(_owner, now);
        }
    }

    /// @notice Vote for token release
    /// @notice Token release may confirm only administration board owners
    /// @notice Min three owners (one of them has to be main owner) has to vote for deletion to remove owner from list
    /// @notice Same owner cannot confirm token release more than once
    /// @notice Voting is only allowed before token was already released
    function confirmTokenRelease()
    public
    tokensNotReleased
    ownerExists(msg.sender)
    notConfirmedTokenRelease(msg.sender)
    {
        confirmedTokenRelease[msg.sender] = true;
        confirmedTokenReleaseCount += 1;
        ownersConfirmedTokenRelease.push(msg.sender);
        ConfirmationTokeRelease(msg.sender, now);
        if (confirmedTokenReleaseCount >= (MIN_CONFIRMATION_MINION_OWNER_COUNT + 1) && confirmedTokenRelease[mainOwner]) {
            finalizeTokenRelease();
        }
    }


    /// @notice Revoke vote for token release
    /// @notice Revocation can only be executed by owner who already voted for token release
    function revokeTokenReleaseConfirmation()
    public
    tokensNotReleased
    ownerExists(msg.sender)
    hasConfirmedTokenRelease(msg.sender)
    {
        confirmedTokenRelease[msg.sender] = false;
        confirmedTokenReleaseCount -= 1;

        for (uint i = 0; i < ownersConfirmedTokenRelease.length - 1 ; i++) {
            if (ownersConfirmedTokenRelease[i] == msg.sender) {
                ownersConfirmedTokenRelease[i] = ownersConfirmedTokenRelease[ownersConfirmedTokenRelease.length - 1];
                break;
            }
        }
        delete ownersConfirmedTokenRelease[ownersConfirmedTokenRelease.length - 1];
        ownersConfirmedTokenRelease.length--;
        RevokedTokenReleaseConfirmation(msg.sender, now);
    }

    /// @notice Vote to reset token owners (with amount of tokens assigned to them) list
    /// @notice Token owners list reset may confirm only administration board owners
    /// @notice Min three owners (one of them has to be main owner) has to vote to execute token owners list reset
    /// @notice Same owner cannot vote for token owners reset more than once
    /// @notice Voting is only allowed before token was already released
    function resetTokenOwners()
    public
    tokensNotReleased
    ownerExists(msg.sender)
    notConfirmedTokenOwnerReset(msg.sender)
    {
        confirmedTokenOwnersResetCount += 1;
        confirmedResetTokenOwners[msg.sender] = true;
        ownersResetTokenOwners.push(msg.sender);

        if (confirmedTokenOwnersResetCount >= (MIN_CONFIRMATION_MINION_OWNER_COUNT + 1) && confirmedResetTokenOwners[mainOwner]) {
            resetTokenOwnersConfirmations();
        }

        ConfirmationTokenOwnerReset(msg.sender, now);
    }

    /// @notice Revoke vote for token owners list reset
    /// @notice Revocation can only be executed by owner who already voted for token owners list reset
    function revokeOwnersTokenReset()
    public
    tokensNotReleased
    ownerExists(msg.sender)
    confirmedTokenOwnerReset(msg.sender)
    {
        confirmedResetTokenOwners[msg.sender] = false;
        confirmedTokenOwnersResetCount -= 1;

        for (uint i = 0; i < ownersResetTokenOwners.length - 1; i++) {
            if (ownersResetTokenOwners[i] == msg.sender) {
                ownersResetTokenOwners[i] = ownersResetTokenOwners[ownersResetTokenOwners.length - 1];
                break;
            }
        }
        delete ownersResetTokenOwners[ownersResetTokenOwners.length-1];
        ownersResetTokenOwners.length--;
        RevokeConfirmationTokenOwnerReset(msg.sender, now);
    }

    /// @notice Add token owners (investors) ethereum account addresses with assigned token supplies
    /// @notice Add token owners address array has to be same size token supply array
    /// @notice Only administration board owners can add token owners with token supply
    function addTokenOwners(
    address[] _tokenOwners,
    uint[] _tokenSupplies
    )
    public
    tokensNotReleased
    ownerExists(msg.sender)
    returns(bool)
    {
        assert(_tokenOwners.length > 0 && _tokenOwners.length == _tokenSupplies.length);

        for (uint i = 0; i < _tokenOwners.length; i++) {
            assert(_tokenSupplies[i] > 0);
            assert(safeAdd(_tokenSupplies[i], assignedTokensSupply) <= safeMul(safeDiv(TOKEN.totalSupply(), HUNDRED_PERCENT), CROWDFUND_PERCENT_OF_TOTAL));

            assignedTokensSupply = safeAdd(_tokenSupplies[i], assignedTokensSupply);
            if (ownersTokenSupply[_tokenOwners[i]] == 0) {
                tokenOwners.push(_tokenOwners[i]);
            }
            ownersTokenSupply[_tokenOwners[i]] = safeAdd(_tokenSupplies[i], ownersTokenSupply[_tokenOwners[i]]);
            AddTokenOwnerSupply(_tokenOwners[i], _tokenSupplies[i], now);
        }
    }

    /// @return owners list who confirmed token release
    function whoConfirmedTokenRelease() constant public returns(address[]) {
        return ownersConfirmedTokenRelease;
    }

    /// @return owners list who confirmed reset of token owners list
    function whoConfirmedTokenOwnersReset() constant public returns(address[]) {
        return ownersResetTokenOwners;
    }

    /// @return get total size of assigned tokens for investors
    function getAssignedTokensSupply() constant public returns(uint) {
        return assignedTokensSupply;
    }


    /// @return list of account addresses of administration board owners
    function getAdministrationBoardOwners() constant public returns(address[]) {
        return owners;
    }

    /// @param _tokenOwner account address of investor
    /// @return token amount assigned to investor
    function getCrowdsaleParticipantTokenSupply(address _tokenOwner) constant public returns(uint256) {
        return ownersTokenSupply[_tokenOwner];
    }

    /// @return addresses of assigned token owners (investors)
    function getCrowdsaleTokenOwners() constant public returns(address[]){
        return tokenOwners;
    }

    /// @notice Executes token release to investors
    /// @notice All left tokens is transferred to man owner
    function finalizeTokenRelease() private {
        _tokensReleased = true;

        for (uint i = 0; i < tokenOwners.length; i++) {
            TOKEN.transfer(tokenOwners[i], ownersTokenSupply[tokenOwners[i]]);
        }

        TokensReleased(now);
        TOKEN.transfer(mainOwner, safeSub(TOKEN.totalSupply(), assignedTokensSupply));
    }

    /// @notice Resets all mappings and arrays which stored data about confirmation of token owners
    /// @notice Confirmation count is set to 0
    /// @notice Reset confirmation count is set to 0
    function resetTokenOwnersConfirmations() private {
        _tokensReleased = false;
        confirmedTokenReleaseCount = 0;
        confirmedTokenOwnersResetCount = 0;

        for (uint i = 0; i < ownersConfirmedTokenRelease.length; i++) {
            confirmedTokenRelease[ownersConfirmedTokenRelease[i]] = false;
        }

        deleteOwnersConfirmedTokenReleaseArray();

        for (uint j = 0; j < ownersResetTokenOwners.length; j++) {
            confirmedResetTokenOwners[ownersResetTokenOwners[j]] = false;
        }

        deleteOwnersResetTokenOwnersArray();

        deleteTokenOwners();
    }

    /// @notice Will delete token owners array and all token supply mappings will be set to 0
    function deleteTokenOwners() private {
        for (uint j = 0; j < tokenOwners.length; j++) {
            ownersTokenSupply[tokenOwners[j]] = 0;
            delete tokenOwners[j];
        }

        tokenOwners.length = 0;
    }

    /// @notice Will delete administration board owners confirmation (of token release)
    function deleteOwnersConfirmedTokenReleaseArray() private {
        for (uint i = 0; i < ownersConfirmedTokenRelease.length; i++) {
            delete ownersConfirmedTokenRelease[i];
        }

        ownersConfirmedTokenRelease.length = 0;
    }

    /// @notice Will delete administration board owners confirmation (of token owners list reset)
    function deleteOwnersResetTokenOwnersArray() private {
        for (uint i = 0; i < ownersResetTokenOwners.length; i++) {
            delete ownersResetTokenOwners[i];
        }

        ownersResetTokenOwners.length = 0;
    }


}