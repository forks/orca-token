var AdministrationBoard = artifacts.require("./AdministrationBoard.sol");

module.exports = function (deployer) {
    deployer.deploy(AdministrationBoard);
};
