"use strict"

var Storage = function (r)
{
	this.r = r
}

Storage.prototype.table = function (name)
{
	return new Table(this.r, name)
}